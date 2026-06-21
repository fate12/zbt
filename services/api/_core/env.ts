/**
 * 环境变量集中读取。
 * 按三方平台分组；换配置时只关注对应分组，完整说明见 services/api/.env.example。
 */
export const ENV = {
    // ─── ② Supabase（数据库 + 存储，影响全部数据读写/上传/鉴权）──────────
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    bucketName: process.env.BUCKET_NAME ?? '',

    // ─── 应用标识（APP_ID 仅用于访客身份 free_visitor_{APP_ID}，非企业微信 API 调用）
    appId: process.env.APP_ID ?? '',

    // ─── ① 阿里云百炼 / DashScope（AI 模型 + 知识库 RAG）─────────────────
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY ?? '',
    dashscopeModel: process.env.DASHSCOPE_MODEL ?? 'qwen-plus',
    embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-v3',
    bailianWorkspaceId: process.env.BAILIAN_WORKSPACE_ID ?? '',
    bailianAppId: process.env.BAILIAN_APP_ID ?? '',                 // 主播通主应用
    bailianDefaultIndexId: process.env.BAILIAN_DEFAULT_INDEX_ID ?? '', // 默认知识索引
    bailianActivityIndexId: process.env.BAILIAN_ACTIVITY_INDEX_ID ?? '',// 活动推荐知识索引

    // ─── ④ 腾讯文档（按需，未用到可留空）────────────────────────────────
    tencentDocsClientId: process.env.TENCENT_DOCS_CLIENT_ID ?? '',
    tencentDocsAccessToken: process.env.TENCENT_DOCS_ACCESS_TOKEN ?? '',
    tencentDocsOpenId: process.env.TENCENT_DOCS_OPEN_ID ?? '',
}
