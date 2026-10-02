# GitHub 登录维护配置

评论和留言以登录者本人的 GitHub 身份发布，网站不代替用户注册账号。网站仅保存加密的短期访问令牌和服务端会话，评论正文及留言以 GitHub Issues 为准。

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

Client secret 只放在 Railway 的服务端变量中，不提交到仓库或客户端文件。持续保留 `/data` 卷，登录会话、提交回执及统计共同使用 `/data/stats.sqlite3`。更换 Client secret 会使旧登录失效，用户需重新登录。

`GITHUB_READ_TOKEN` 是可选的只读 Issues 令牌，用于提高未登录访客读取公开评论的 GitHub 配额。它不能用于替代用户登录。

## 登录与提交保护

- 登录使用一次性 state、PKCE 和十分钟回调有效期；仅允许返回站内详情及留言页。
- 会话保存在服务端，Cookie 使用 HttpOnly、SameSite=Lax，线上使用 Secure。会话最多八小时，不自动延长用户授权。
- 写请求需要同源 Origin 和与会话绑定的 CSRF 令牌。用户只能操作自己的留言及评论；维护权限在删除时重新向 GitHub 校验。
- 提交回执随持久卷保存。同一个请求重复发送只返回原结果；响应中断时，先查找 GitHub 上的原记录，避免重复发布。
- GitHub 关闭的留言不再显示在网站。已收录内容的删除需要维护者确认，并经 `delete-content.yml` 工作流再次校验身份、标签和内容版本。

## 验证

运行 `npm test` 和 `npm run check`。测试覆盖 OAuth 回调、防伪请求、会话持久化、评论和留言写入、去重、权限撤销、内容删除和旧投稿防恢复。自动化测试使用隔离的 GitHub 响应，不向真实仓库发布。

配置后，还应使用真实 GitHub 账号进行一次站内登录和留言提交验证。生产环境测试请使用明确标记的测试留言，完成后撤回，保留可追溯记录。
