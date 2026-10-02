# GitHub 登录维护配置

投稿、评论和留言以登录者本人的 GitHub 身份发布，网站不代替用户注册账号。网站保存加密的短期访问令牌和服务端会话，投稿正文、评论及留言以 GitHub Issues 为准。

## GitHub App

在网站维护者的 GitHub 账号下创建应用：

- 名称：USYD Events Wall
- Homepage URL：`https://usyd.life`
- Callback / Redirect URI：`https://usyd.life/auth/github/callback`，不开启通配符
- Expire user authorization tokens：开启
- Webhook：关闭（发布、删除通过仓库 Actions 的 Issue 事件处理）
- Repository permissions：Issues **Read and write**，Metadata **Read-only**
- Account / Organization permissions：不申请
- 仅安装到 `snowhejia/usyd.life`
- 如需向所有同学开放登录，应用可见性需设为 Public；这与仓库安装范围是两项独立设置。用户令牌通过 `repository_id` 再限制到本仓库。

不需要给应用 Contents、Actions、Administration 或 Workflows 权限。应用只负责登录及操作 Issues；内容变更由仓库内的工作流使用其 `GITHUB_TOKEN` 执行。

## Railway 变量

在现有 `usyd.life` 服务的 Variables 中设置：

```text
PUBLIC_ORIGIN=https://usyd.life
GITHUB_CLIENT_ID=<GitHub App 的 Client ID>
GITHUB_CLIENT_SECRET=<GitHub App 的 Client secret>
GITHUB_REPOSITORY_ID=1402408149
```

Client secret 只放在 Railway 的服务端变量中，不提交到仓库或客户端文件。持续保留 `/data` 卷，登录会话、提交回执、投稿配图及统计共同使用 `/data/stats.sqlite3`。更换 Client secret 会使旧登录失效，用户需重新登录。

`GITHUB_READ_TOKEN` 是可选的只读 Issues 令牌，用于提高未登录访客读取公开评论的 GitHub 配额。它不能用于替代用户登录。

## 登录与提交保护

- 登录使用一次性 state、PKCE 和十分钟回调有效期；仅允许返回站内详情、留言及投稿页。
- 会话保存在服务端，Cookie 使用 HttpOnly、SameSite=Lax，线上使用 Secure。会话最多八小时，不自动延长用户授权。
- 写请求需要同源 Origin 和与会话绑定的 CSRF 令牌。用户只能操作自己的留言及评论；维护权限在删除时重新向 GitHub 校验。
- 提交回执随持久卷保存。同一个请求重复发送只返回原结果；响应中断时，先查找 GitHub 上的原记录，避免重复发布。
- GitHub 关闭的留言不再显示在网站。已收录内容的删除需要维护者确认，并经 `delete-content.yml` 工作流再次校验身份、标签和内容版本。
- 投稿接口复用收录工作流的字段校验，只创建普通投稿，不替投稿者添加审核通过标签。纠错提交保留编辑起点的版本信息，避免覆盖其他人的新修改。

## 投稿图片

登录后通过 `/api/submissions/images` 上传 PNG、JPG、GIF 或 WebP；服务端检查文件签名和 5 MB 上限。草稿图片只有上传者能读取，确认投稿后才公开供 GitHub Issue 访问。图片内容和归属保存在持久卷的 SQLite 中，重启或部署不会丢失。

单用户每日最多 50 次上传、100 MB，图片存储总量上限 512 MB；超限时返回可读错误，不影响文字投稿。超过七天未提交的草稿图片会在下次上传时清理，已经随 Issue 提交的图片保留。前端会保留已上传图片的引用，网络重试复用上传标识。

图片公开地址为 `https://usyd.life/media/submissions/<随机文件名>`。审核工作流只接受此固定地址模式或 GitHub 附件地址；下载时检查跳转、字节类型与大小，并且不发送 GitHub 令牌。审核通过后，图片保存到仓库并在 Issue 回执中提供固定提交版本的备份链接。

## 验证

运行 `npm test` 和 `npm run check`。测试覆盖 OAuth 回调、防伪请求、会话持久化、四种投稿、纠错版本、图片持久化与访问权限、评论和留言写入、去重、权限撤销、内容删除和旧投稿防恢复。自动化测试使用隔离的 GitHub 响应，不向真实仓库发布。

配置后，还应使用真实 GitHub 账号进行一次站内登录和留言提交验证。生产环境测试请使用明确标记的测试留言，完成后撤回，保留可追溯记录。
