# Upload 组件

基于 [`react-dropzone`](https://react-dropzone.js.org/) + shadcn UI 的轻量上传组件。**请直接使用本目录下的现成组件，不要自己写 `<input type="file">` + `fetch("/api/upload")`** —— 那样会丢掉进度、abort、受控双模式、错误重试、toast 等内置能力。如需扩展请通过 Props / `useUpload` hook 组合。

| 组件               | 形态                                                  | 典型场景                       |
| ------------------ | ----------------------------------------------------- | ------------------------------ |
| `ImageUpload`      | 图片缩略图 grid + tile（单/多图由 `maxCount` 控制）   | 头像、封面图、九宫格画廊、image_url       |
| `AttachmentUpload` | 按钮 + 文件列表                                       | 表单内"附件"字段               |
| `DragUpload`       | 大面积拖拽区 + 列表                                   | 批量导入、独立上传页           |

---

## 🚨 必读：API 心智模型（AI 生成代码前请先读）

### 唯一类型契约

| Prop            | 类型                              | 说明                                                                                  |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| `value`         | `UploadFile[]`                    | **是数组、元素是 `UploadFile` 对象**。不是 `string`，也不是 `string[]`。              |
| `onChange`      | `(files: UploadFile[]) => void`   | 收到的是**整份 `UploadFile[]`**，不是 url 字符串。                                    |
| 表单字段        | `unknow`             | 如果表单存的是 url（string / string[]），**不能直接喂给 `value`**，必须用 `useState + createPreviewFile` 中转。 |

### 标准模板（对接 `formData.image_url: string`）

```tsx
import { ImageUpload, createPreviewFile, type UploadFile } from "@/components/upload"

// 1) useState 以 UploadFile[] 作为唯一真实来源；初始回显只在延迟初始化中调用一次 createPreviewFile
const [pics, setPics] = React.useState<UploadFile[]>(() =>
  formData.image_url ? [createPreviewFile(formData.image_url)] : [],
)

// 2) onChange 拿到 UploadFile[]，仅在拿到 response.url 后才回写表单 url
const handleImageChange = (files: UploadFile[]) => {
  setPics(files)
  if (files.length === 0) {
    setFormData((d) => ({ ...d, image_url: "" }))
    return
  }
  const url = files[0]?.response?.url
  if (typeof url === "string") {
    setFormData((d) => ({ ...d, image_url: url }))
  }
}

<ImageUpload value={pics} onChange={handleImageChange} aspectRatio={16 / 9} />
```

多图字段（`formData.images: string[]`）：

```tsx
const [pics, setPics] = React.useState<UploadFile[]>(() =>
  (formData.images ?? []).map(createPreviewFile),
)
const handleImagesChange = (files: UploadFile[]) => {
  setPics(files)
  const urls = files
    .map((f) => f.response?.url)
    .filter((u): u is string => typeof u === "string")
  setFormData((d) => ({ ...d, images: urls }))
}
<ImageUpload maxCount={9} value={pics} onChange={handleImagesChange} />
```

### 五条铁律

1. **`value` 是 `UploadFile[]`**，不是 `string`。表单字段是 `string` 必须经 `useState + createPreviewFile` 中转。
2. **`onChange` 收 `UploadFile[]`**，不是 `url`。要拿 url 请读 `files[0]?.response?.url`。
3. **`value` 由 `useState` 持有**，不能从 `formData` / `props` 现场三元式派生。
4. **`createPreviewFile` 只在 `useState(() => ...)` 里调用一次**，否则每次 render 重生 id、上传中间态会被冲掉。
5. **不要自己传 `onUpload`**：未传时默认已经走 `defaultUploader`（自动 `POST /api/storage/upload`，含进度/abort/鉴权）。除非业务确需走非默认上传协议（如直传 OSS、特殊鉴权头），**否则不要传 `onUpload`**，避免重复造轮且丢失默认能力。

### 反例集

```tsx
// ❌ 1：把 string 当 value、onChange 收 url
<ImageUpload
  value={formData.image_url}
  onChange={(url) => setFormData((p) => ({ ...p, image_url: url }))}
/>

// ❌ 2：JSX 里现场从 formData 派生 UploadFile[]（每次 render 新 id，上传中间态被冲掉）
<ImageUpload
  value={formData.image_url ? [createPreviewFile(formData.image_url)] : []}
  onChange={handleImageChange}
/>

// ❌ 3：传了 value 但没传 onChange / onChange 是 noop（受控但无法回写）
<ImageUpload value={pics} maxCount={5} />
<ImageUpload value={pics} onChange={() => {}} maxCount={5} />

// ❌ 4：只回写 url、忘了 setPics（pics 不更新，进度条/预览全卡住）
const handleImageChange = (files: UploadFile[]) => {
  const url = files[0]?.response?.url
  if (url) setFormData((d) => ({ ...d, image_url: url }))
}

// ❌ 5：手写 onUpload 重复造轮（默认已经有 defaultUploader，传了反而丢失进度/abort/鉴权）
<ImageUpload
  onUpload={async (file) => {
    const fd = new FormData(); fd.append("file", file)
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    return await res.json()
  }}
  value={pics}
  onChange={handleImageChange}
/>
// ✅ 直接不传 onUpload，走内置默认实现
<ImageUpload value={pics} onChange={handleImageChange} />
```

> 一次性选文件、不需要外部读 value：**不传 `value` 即可（非受控）**；只需要初始回显但后续不读：用 `defaultValue={[createPreviewFile(url)]}`。

---

## 通用 Props

| 字段           | 类型                                      | 说明                                                                                  |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `onUpload` ⚠️  | `Uploader`                                | **默认不要传**。未传时自动走 `defaultUploader`（`POST /api/storage/upload`，含进度/abort/鉴权）；仅在需要走非默认上传协议（如直传 OSS、特殊鉴权头）时才自定义 |
| `value`        | `UploadFile[]` ⚠️                         | **是 `UploadFile[]`**，详见顶部「API 心智模型」                                       |
| `defaultValue` | `UploadFile[]`                            | 非受控初始值（可用 `[createPreviewFile(url)]` 回显）                                  |
| `onChange`     | `(files: UploadFile[]) => void` ⚠️        | **参数是整份 `UploadFile[]`**；列表任何变化都会触发（含进度更新）                     |
| `onFileChange` | `(file: UploadFile) => void`              | 单文件变化时触发，便于做单点持久化                                                    |
| `accept`       | `Record<string, string[]>`                | 接受的 MIME / 扩展名，遵循 `react-dropzone` 协议。`ImageUpload` 未传时默认 `DEFAULT_IMAGE_ACCEPT`（`.jpg .jpeg .png .gif .webp .svg .bmp`）；`AttachmentUpload` / `DragUpload` 未传时默认 `DEFAULT_ATTACHMENT_ACCEPT`（图片/文档/表格/演示文稿/文本/压缩包） |
| `maxSize`      | `number`                                  | 单文件最大字节数，默认 `5 * 1024 * 1024`（5MB），超出自动 toast                       |
| `maxCount`     | `number`                                  | 最大文件数。`ImageUpload` 默认 `1`，传 `>1` 切换为多图模式                            |
| `disabled`     | `boolean`                                 | 整体禁用                                                                              |
| `onReject`     | `(rejections: UploadRejection[]) => void` | 文件被拒绝（超大/类型不符/超数量）                                                    |
| `className`    | `string`                                  | 容器额外 className                                                                    |

### 类型定义

```ts
type Uploader = (
  file: File,
  ctx: { onProgress?: (percent: number) => void; signal?: AbortSignal },
) => Promise<UploadResponse>

interface UploadFile {
  id: string                                              // 内部唯一 id
  file?: File                                              // 原始 File
  status?: "idle" | "uploading" | "success" | "error"
  progress?: number                                        // 0-100
  error?: string
  response?: Record<string, unknown>                       // uploader 返回的完整响应（含 url/fileName/size/contentType）
}
```

> 自定义 `onUpload` 实现请参考 [`use-upload.ts`](./use-upload.ts) 中的 `defaultUploader`：监听 `signal.aborted` 取消请求、调 `onProgress(percent)` 上报进度、最终 `resolve` 一个含 `url` 的对象。
>
> 图片预览 src 由 `useImagePreviewSrc(file)` 统一计算：优先 `response.url`（服务端原始相对路径，由 `resolveUrl(url, true)` 按当前场景拼接为绝对地址），否则对原始 `file` 即时 `URL.createObjectURL`，自动 revoke。对空文件 / 非 `File` 实例都有兜底，不会白屏。

### `createPreviewFile` —— 回显已持久化的 url

```ts
import { createPreviewFile } from "@/components/upload"

createPreviewFile("https://cdn.xxx.com/a.png")
createPreviewFile({ url: "https://cdn.xxx.com/a.png", fileName: "cover.png", size: 1024 })
```

生成只填 `id` 与 `response` 的 `UploadFile`（其余字段都是可选的）。**只能在 `useState(() => ...)` 里调用一次**。

### 在上传组件外单独预览图片

表单提交后，`response.url` / `formData.image_url` 存储的是**服务端返回的相对路径**。
若要在上传组件以外（如详情页、弹窗预览、独立 `<img>` 标签）展示图片，**不能直接把相对路径赋给 `src`**，必须先用 `resolveUrl(url, true)` 拼接为绝对地址：

```tsx
import { resolveUrl } from "@/lib/url"

// ✅ 单图预览
<img src={resolveUrl(formData.image_url, true)} alt="预览" />

// ✅ 多图预览
{(formData.images ?? []).map((url) => (
  <img key={url} src={resolveUrl(url, true)} alt="预览" />
))}

// ❌ 错误：直接使用相对路径，跨场景 / 不同 BASE_URL 时会 404
<img src={formData.image_url} alt="预览" />
```

> `resolveUrl(url, true)` 会自动判断：若已是 `http(s)` 绝对地址则原样返回；若是相对路径则拼接 `window.location.origin + BASE_URL 前缀`，适配不同部署场景下路径前缀不一致的情况。SSR / 非浏览器环境下安全返回原值。

---

## ImageUpload

接入示例见上方「标准模板」；专属 Props：

- `maxCount`：默认 `1`（单图）。`>1` 切换为多图九宫格。输入会被规范化：非有限数 / 负数 / `0` → `1`，小数取整
- `placeholder`：空态文案，默认 `"点击或拖拽上传图片"`（多图模式为 `"Upload"`）
- `aspectRatio`：默认 `1`（正方形），可设为 `16/9` 等
- `classNames`：`{ root, placeholder, preview, image, overlay, error }`

特性：本地预览即时显示；上传中半透明遮罩 + 进度条 + 百分比；失败 tile 高亮 + 重试按钮；hover 出"移除"按钮；单图模式选中后入口隐藏，多图模式末尾固定 `+ Upload` dropzone。

---

## AttachmentUpload

```tsx
import { AttachmentUpload } from "@/components/upload"

<AttachmentUpload
  triggerText="上传附件"
  hint="支持 pdf/docx/zip，单文件 ≤ 5MB，最多 5 个"
  accept={{ "application/pdf": [".pdf"], "application/zip": [".zip"] }}
  maxSize={5 * 1024 * 1024}
  maxCount={5}
/>
```

专属 Props：`triggerText` / `triggerVariant` / `triggerSize` / `hint` / `showThumbnail`（默认 `true`） / `classNames: { root, trigger, list, item }`。

特性：按钮选择 + 拖入区域双通道；达 `maxCount` 自动禁用按钮；列表行展示缩略图 / 文件名 / 大小或进度 / 状态 / 重试-移除。

---

## DragUpload

```tsx
import { DragUpload } from "@/components/upload"

<DragUpload
  multiple
  maxCount={10}
  accept={{ "image/*": [], "application/pdf": [".pdf"] }}
/>

<DragUpload multiple={false} title="拖入 CSV 文件以导入" description="表头需匹配模板" />
```

专属 Props：`multiple`（默认 `true`，`false` 时新文件替换旧文件） / `title` / `description`（`null` 隐藏，未传则按 accept/maxSize/maxCount 自动生成）/ `icon` / `showThumbnail` / `classNames: { root, dropzone, icon, title, description, list, item }`。

特性：拖入合法变蓝、`isDragReject` 变红。

---

## 复用底层 hook

默认形态不满足时直接组合 `useUpload`：

```tsx
import { useUpload, FileList } from "@/components/upload"

const { files, addFiles, handleDrop, remove, retry, clear } = useUpload({ multiple: true })
// 自定义触发器/布局，列表 UI 复用 <FileList files={files} onRemove={...} onRetry={...} />
```

| 方法         | 说明                                  |
| ------------ | ------------------------------------- |
| `addFiles`   | 接收 `File[]`，自动转换并触发上传     |
| `handleDrop` | 直接喂给 `useDropzone` 的 `onDrop`    |
| `remove`     | 移除并 abort 请求                     |
| `retry`      | 重传失败项                            |
| `clear`      | 清空全部                              |

---

## 样式定制

所有组件都接收 `className`（最外层）和 `classNames`（按 slot 细分），通过 `cn()` 合并到默认 class 之后会**覆盖默认样式**（`tailwind-merge`）。颜色全用主题变量（`bg-muted` / `text-destructive` / `border-primary`），跟随主题切换。

```tsx
<DragUpload classNames={{ dropzone: "min-h-[240px] border-blue-500 bg-blue-50/30", title: "text-blue-600" }} />
```
