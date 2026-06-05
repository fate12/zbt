/**
 * Upload 组件通用类型定义。
 *
 * 三个上传组件（image / attachment / drag）共享同一套数据模型与 API，
 * 方便业务方以统一心智模型使用，也方便 AI 二次生成与修改。
 */

/**
 * ImageUpload 的默认图片类型白名单。
 *
 * 与 DEFAULT_ATTACHMENT_ACCEPT 中的图片部分保持一致：
 * `.jpg .jpeg .png .gif .webp .svg .bmp`。
 * 业务方可通过 `accept` prop 覆盖，传入 `undefined` 表示不限类型。
 *
 * 格式遵循 react-dropzone 协议：{ "MIME类型": [".ext1", ".ext2"] }
 */
export const DEFAULT_IMAGE_ACCEPT: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
  "image/bmp": [".bmp"],
}


/**
 * AttachmentUpload / DragUpload 的默认文件类型白名单。
 *
 * 覆盖常见的图片、文档、电子表格、演示文稿、文本及压缩包格式。
 * `.jpg, .jpeg, .png, .gif, .webp, .svg, .bmp, .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt, .csv, .zip`
 * 业务方可通过 `accept` prop 覆盖，传入 `undefined` 表示不限类型。
 *
 * 格式遵循 react-dropzone 协议：{ "MIME类型": [".ext1", ".ext2"] }
 */
export const DEFAULT_ATTACHMENT_ACCEPT: Record<string, string[]> = {
  // 图片
  ...DEFAULT_IMAGE_ACCEPT,
  // 文档
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  // 电子表格
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  // 演示文稿
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  // 文本 & 数据
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  // 压缩包
  "application/zip": [".zip"],
}

/** 单个文件在上传流水线中的状态。 */
export type UploadStatus = "idle" | "uploading" | "success" | "error"

/**
 * 上传文件的运行时数据结构。
 *
 * 同时承载本地 File 对象（用于重试）与上传成功后的 uploader 完整响应
 * 组件内部以 id 为主键管理列表，
 * 避免依赖 File 引用相等。
 */
export interface UploadFile {
  /** 内部唯一 id（非业务字段，组件自动生成）。 */
  id: string
  /** 浏览器原始 File 对象，重试与本地图片预览均依赖它。 */
  file?: File
  /** 当前上传状态。 */
  status?: UploadStatus
  /** 上传进度，0-100。仅 status === "uploading" 时持续更新。 */
  progress?: number
  /** 上传失败时的错误信息。 */
  error?: string
  /**
   * uploader 成功后返回的完整响应，原样透传给业务方。
   */
  response?: UploadResponse
}

/**
 * 上传过程回调上下文。
 *
 * - onProgress: uploader 在分片/xhr 进度变化时调用，传入 0-100 的整数。
 * - signal: 当用户移除文件或组件卸载时会触发 abort，uploader 应当尊重它。
 */
export interface UploaderContext {
  onProgress: (percent: number) => void
  signal: AbortSignal
}

/**
 * 业务方提供的真正执行上传的函数。
 *
 * 抛出错误（或 reject）会被组件捕获并标记为 error 状态。
 */
export type Uploader = (
  file: File,
  ctx: UploaderContext,
) => Promise<UploadResponse>

/**
 * 上传组件的公共 Props 基类。各业务组件按需扩展。
 */
export interface UploadCommonProps {
  /**
   * ⚠️ **默认不要传**。
   *
   * 不传时组件会自动走内置的 `defaultUploader`：`POST /api/storage/upload`，
   * 自带 **进度回调 / AbortSignal / 鉴权头 / 服务端相对路径拼 origin** 等能力。
   * 自己重写 `onUpload` 往往会丢失这些默认能力（典型如把 `fetch("/api/upload")` 直接包一层，
   * 既不响应 abort，也没有 progress、相对路径也不会拼 origin）。
   *
   * ✅ 推荐：直接不传
   *   ```tsx
   *   <ImageUpload value={pics} onChange={setPics} />
   *   ```
   *
   * ❌ 反例（默认能力会全部丢失）：
   *   ```tsx
   *   <ImageUpload
   *     onUpload={async (file) => {
   *       const fd = new FormData(); fd.append("file", file)
   *       const res = await fetch("/api/upload", { method: "POST", body: fd })
   *       return await res.json()
   *     }}
   *     value={pics} onChange={setPics}
   *   />
   *   ```
   *
   * 仅当业务确需走非默认协议（直传 OSS、特殊鉴权头、私有上传服务）时才自定义。
   * 即便要自定义，也务必尊重 `ctx.signal` 与 `ctx.onProgress`。
   */
  onUpload?: Uploader

  /**
   * 受控值。**类型必须严格是 `UploadFile[]` 数组**。
   *
   * ⚠️ 关键约束：
   *   1. **绝对不能把字符串（如 `formData.image_url`）赋给 `value`**，类型不符且会引发渲染异常。
   *   2. **绝对不能在 JSX 里现场三元派生数组**，例如
   *      `value={formData.image_url ? [createPreviewFile(formData.image_url)] : []}`：
   *      每次 render 都会生成全新的 `UploadFile.id`，导致 `uploading` / `progress` 等中间态丢失、
   *      重复触发上传副作用。
   *   3. 外部字符串数据（如表单回显的 `image_url` / `attachment_urls`）只能在
   *      `useEffect` 中**一次性**转成 `UploadFile[]` 后 `set` 进 state，或通过 `defaultValue` 注入；
   *      不能参与 `value` 的实时计算。
   *
   * ✅ 标准用法：
   *   ```tsx
   *   const [pics, setPics] = useState<UploadFile[]>([])
   *
   *   // 历史回显（仅初始化时执行一次）
   *   useEffect(() => {
   *     if (formData.image_url) {
   *       setPics([createPreviewFile(formData.image_url)])
   *     }
   *   }, []) // 仅初始化时执行一次，按需添加对应依赖
   *
   *   <ImageUpload
   *     value={pics}
   *     onChange={(next) => {
   *       setPics(next)
   *       // 提交时再从 next 里拿 response.url 写回 formData
   *     }}
   *   />
   *   ```
   *
   * ❌ 反例：
   *   - `value={formData.image_url}`                                          // string 不是 UploadFile[]
   *   - `value={formData.image_url ? [createPreviewFile(...)] : []}`           // JSX 现场派生，中间态会丢
   *   - `value={[{ id: formData.image_url, file: ... } as UploadFile]}`        // 硬拼伪对象
   */
  value?: UploadFile[]

  /**
   * 非受控初始值。仅在挂载时读取一次，之后 state 由组件内部管理。
   * 适合"只回显、不再受控更新"的纯展示场景；需要双向同步请改用 `value` + `onChange`。
   */
  defaultValue?: UploadFile[]

  /**
   * 文件列表变化时触发（包含进度、状态等任意变化）。
   * 业务方一般在这里 `setPics(next)` 同步 state；提交表单时再从 `next` 取 `response.url` 写回业务字段。
   */
  onChange?: (files: UploadFile[]) => void
  /** 单个文件变化时触发，便于业务做单点持久化。 */
  onFileChange?: (file: UploadFile) => void
  /**
   * 接受的 MIME / 扩展名规则。
   * 形如：{ "image/*": [".png", ".jpg"] }，遵循 react-dropzone 协议。
   */
  accept?: Record<string, string[]>
  /** 单文件最大字节数。超过会触发 onReject。 */
  maxSize?: number
  /** 最大文件数量。多文件组件超过会触发 onReject。 */
  maxCount?: number
  /** 是否禁用整体交互。 */
  disabled?: boolean
  /** 文件被拒绝时触发（超大、类型不符、超数量等）。 */
  onReject?: (rejections: UploadRejection[]) => void
  /** 容器额外 className。 */
  className?: string
}

/** 文件被拒绝时的描述。 */
export interface UploadRejection {
  file: File
  reason: "file-too-large" | "file-invalid-type" | "too-many-files" | "unknown"
  message: string
}

/**
 * 上传接口返回的数据结构。
 *
 * 服务端 `POST /api/storage/upload` 成功时返回 `{ success: true, data: { url, fileName, size, contentType, ... } }`；
 * 失败时返回 `{ success: false, error: string }`。
 *
 * `UploadResponse.url` 存储服务端返回的原始**相对路径**。
 * 绝对地址的拼接在 `useImagePreviewSrc` 中按具体场景完成，
 * 支持不同场景下应用前缀不一致的情况。
 */
export interface UploadResponse {
  /** 服务端返回的原始相对访问路径。预览时由 `useImagePreviewSrc` 按具体场景拼接为绝对地址。 */
  url?: string
  /** 服务端返回的原始文件名。 */
  fileName: string
  /** 文件大小（字节）。 */
  size?: number
  /** 文件 MIME 类型。 */
  contentType?: string
  /** 允许服务端返回额外字段。 */
  [key: string]: unknown
}
