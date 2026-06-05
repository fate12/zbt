import { getAuthHeader } from "@/lib/auth"
import { resolveUrl } from "@/lib/url"
import type { UploadResponse } from "./types"

// ============================================================
// Upload — API layer
// Centralised upload function so components don't need an
// uploader prop; they can call this directly.
// ============================================================

/**
 * Upload a single file to the server.
 * @param file - The browser File object to upload.
 * @param onProgress - Optional callback receiving 0-100 progress updates.
 * @param signal - Optional AbortSignal to cancel the upload.
 * @returns
 */
export function uploadFile(
  file: File,
  options: {
    onProgress?: (percent: number) => void
    signal?: AbortSignal
  } = {},
): Promise<UploadResponse> {
  const { onProgress, signal } = options

  const formData = new FormData()
  formData.append("file", file)

  const xhr = new XMLHttpRequest()

  const responsePromise = new Promise<UploadResponse>((resolve, reject) => {
    const url = resolveUrl(`/api/storage/upload`)
    xhr.open("POST", url)

    // Apply auth headers
    const authHeaders = getAuthHeader()
    for (const [key, value] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(key, value as string)
    }

    // Progress tracking
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      })
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText)
          if (json.success && json.data) {
            const data = json.data as UploadResponse
            // 保持服务端返回的相对路径原样存入 data.url，
            // 绝对地址拼接统一在 useImagePreviewSrc 中按场景完成。
            resolve(data)
          } else {
            const error = json.error || "Upload failed";
            const errorMsg = typeof error === 'string' 
              ? error 
              : (error?.message ?? error?.toString?.() ?? JSON.stringify(error));
            reject(new Error(errorMsg))
          }
        } catch {
          reject(new Error("Upload failed: invalid JSON response"))
        }
      } else {
        const body = xhr.responseText?.trim()
        let bodyMsg = ""
        if (body) {
          try {
            const parsed = JSON.parse(body)
            bodyMsg = parsed?.error ?? parsed?.message ?? body
          } catch {
            bodyMsg = body
          }
        }
        const detail = bodyMsg ? ` — ${bodyMsg}` : ""
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText} ${detail}`))
      }
    })

    xhr.addEventListener("error", () => reject(new Error("Upload failed: network error")))
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")))

    // Wire up AbortSignal
    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        reject(new Error("Upload aborted"))
        return
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true })
    }

    xhr.send(formData)
  })

  return responsePromise
}

/**
 * Convenience wrapper that adapts `uploadFile` to the `Uploader` signature
 * expected by the upload components (`use-upload.ts`).
 *
 * Usage:
 * ```tsx
 * import { defaultUploader } from "@/components/upload/api"
 * <ImageUpload onUpload={defaultUploader} />
 * ```
 */
export const defaultUploader = (
  file: File,
  ctx: { onProgress: (percent: number) => void; signal: AbortSignal },
): Promise<UploadResponse> => {
  return uploadFile(file, {
    onProgress: ctx.onProgress,
    signal: ctx.signal,
  })
}
