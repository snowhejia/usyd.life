# GitHub 登录与社区功能维护

投稿、评论和留言以登录者本人的 GitHub 身份发布，网站不代替用户注册账号。网站保存加密的短期访问令牌和服务端会话，投稿正文、评论及留言以 GitHub Issues 为准。

本文面向网站维护者。内容审核、纠错与删除操作见 [维护指南](../CONTRIBUTING.md)，面向使用者的说明见 [README](../README.md)。

## GitHub App

维护现有 GitHub App 时，核对以下配置要求：

- 名称：USYD Events Wall
- Homepage URL：`https://usyd.life`
- Callback / Redirect URI：`https://usyd.life/auth/github/callback`，不开启通配符
- Expire user authorization tokens：开启
- Webhook：关闭（发布、删除通过仓库 Actions 的 Issue 事件处理）
- Repository permissions：Issues **Read and write**，Metadata **Read-only**
- Account / Organization permissions：不申请
- 仅安装到 `snowhejia/usyd.life`
- 面向所有同学开放登录时，应用可见性使用 Public。公开应用允许其他账号安装，但网站维护者账号下的安装范围仍仅为上述仓库；网站交换用户令牌时，通过 `repository_id` 再限制到本仓库。

不需要给应用 Contents、Actions、Administration 或 Workflows 权限。应用只负责登录及操作 Issues；内容变更由仓库内的工作流使用其 `GITHUB_TOKEN` 执行。

## Railway 变量

在现有 `usyd.life` 服务的 Variables 中设置：

```text
PUBLIC_ORIGIN=https://usyd.life
GITHUB_CLIENT_ID=<GitHub App 的 Client ID>
GITHUB_CLIENT_SECRET=<GitHub App 的 Client secret>
GITHUB_REPOSITORY_ID=1402408149
```

Client secret 只放在 Railway 的服务端变量中，不提交到仓库、客户端文件、公开 Issue 或日志。更换 Client secret 会使旧登录失效，用户需重新登录。

`GITHUB_READ_TOKEN` 是可选的只读 Issues 令牌，用于网站服务端读取公开评论和留言；如配置，应限制到本仓库及读取所需权限。它不能用于替代用户登录。未配置时，这些读取走 GitHub 未认证请求额度；是否配置须核对 Railway 变量，不能仅凭站内登录可用来判断。[GitHub 接口限额](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)

## 持久化与备份

服务端使用挂载在 `/data` 的持久卷，SQLite 文件为 `/data/stats.sqlite3`。正常部署保留数据的前提是继续挂载同一个卷；不要用本地测试库覆盖线上数据库。

- 卷中保存访问和点赞统计、加密登录会话、提交去重回执、投稿图片及其归属。未审核图片没有仓库备份。
- GitHub 保存投稿、评论、留言，以及通过审核后提交的内容数据与图片备份。它不包含网站的完整数据库，不能恢复点赞、访问统计或会话。
- 持久卷与自动备份是不同设置。需要在 Railway 的 Backups 中核对备份计划、最近成功记录和恢复方式。当前文档没有确认线上已启用自动备份，不应将其标为已完成。[Railway 卷备份](https://docs.railway.com/volumes/backups)
- 本地测试使用临时数据库和模拟 GitHub。恢复验证也应使用隔离环境，避免覆盖现有内容；手工备份运行中的 SQLite 时需使用一致性备份方式，不能只复制主文件而忽略 WAL。

## 登录与提交保护

- 登录使用一次性 state、PKCE 和十分钟回调有效期；仅允许返回站内详情、留言及投稿页。
- 会话保存在服务端，Cookie 使用 HttpOnly、SameSite=Lax，线上使用 Secure。会话最多八小时，不自动延长用户授权。
- 投稿、上传图片、评论、留言、退出登录和删除等登录写操作，需要同源 Origin 和与会话绑定的 CSRF 令牌。匿名点赞与访问统计使用签名访客 Cookie 和来源检查，不采用这套登录会话校验。
- 普通用户只能删除自己的评论、撤回自己的留言；已收录条目只有维护者可以删除。维护权限取决于仓库的写入、维护或管理权限，在执行受限操作时重新向 GitHub 校验。
- 提交回执随持久卷保存。同一个请求重复发送只返回原结果；响应中断时，先查找 GitHub 上的原记录，避免重复发布。
- 站内撤回留言会关闭 GitHub Issue 并使留言缓存失效；直接在 GitHub 关闭的留言会在缓存刷新后从网站移除。已收录内容的删除需要维护者确认，并经 `delete-content.yml` 工作流再次校验身份、标签和内容版本。
- 投稿接口复用收录工作流的字段校验，只创建普通投稿，不替投稿者添加审核通过标签。纠错提交保留编辑起点的版本信息，避免覆盖其他人的新修改。
- HTML 页面、`data.js` 和 `discussions.js` 向浏览器与 CDN 返回 `no-store`，部署后重新打开或刷新页面即可加载新收录内容和评论关联。不要对这些路径配置覆盖源站响应的强制缓存规则。
- 来源链接和通知截图至少提供一种。截图替代链接时，仍校验图片地址与上传归属，沿用原有公开和备份流程；收录后将截图保存在详情页的「查看原始通知」中。
- 评论与留言提交后直接公开。留言读取会收集开放且标题以 `[留言]` 开头的 Issue；详情评论读取对应的讨论 Issue。直接在 GitHub 发布的内容同样可能同步到网站。

## 投稿图片

登录后通过 `/api/submissions/images` 上传 PNG、JPG、GIF 或 WebP，单张最多 5 MB，每篇投稿最多 3 张。服务端目前检查文件头签名和大小，没有完整解码、重新编码或检查图片尺寸，也不判断图片是否包含广告、不当内容或私人信息。

草稿图片只有上传者能读取。点击「确认投稿」时，服务端先将图片设为公开，再创建 GitHub Issue；这一步发生在人工审核之前。如果 GitHub 请求失败，图片的公开状态也不会自动回滚。图片内容和归属保存在持久卷的 SQLite 中。

超过七天且尚未公开的草稿图片，会在下一次新上传触发清理时移除；已经公开的图片不会自动到期。表单移除配图仅取消引用，关闭 Issue、拒绝投稿或删除已收录内容也不会删除图片。前端保留已上传图片的引用，网络重试复用上传标识。

图片公开地址为 `https://usyd.life/media/submissions/<随机文件名>`。审核工作流只接受此固定地址模式或 GitHub 附件地址；下载时检查跳转、字节类型与大小，并且不发送 GitHub 令牌。审核通过后，图片保存到仓库并在 Issue 回执中提供固定提交版本的备份链接。

## 当前限额与待完成项

现有应用层限制如下，直接在 GitHub 操作的内容不受这些站内额度限制：

- 创建投稿、评论、留言和内容删除请求共用每账号每小时 30 次、相邻新请求至少间隔 5 秒的限制。图片上传另行计数；评论删除、留言撤回和公开读取也不在此计数内。
- 图片上传按滚动 24 小时统计，每账号最多 50 张、100 MB；全部图片记录的字节总量最多 512 MB。这不是整块持久卷的容量限制，数据库其他内容和文件开销另计。
- 超出图片额度会拒绝新上传，仍可提交文字；相同上传标识的重试复用原图片。
- 评论和留言读取有缓存，但未设置全站统一的账号或 IP 限流。访客和点赞按浏览器 Cookie 去重，不代表同一自然人只能计数一次。

以下事项尚未完成，文档中的计划不代表已经上线：

- [ ] 待审核图片仅作者及维护者可访问，并提供相应审核入口。当前 GitHub Issue 直接显示图片依赖图片提前公开，调整时需同步改变审核流程。
- [ ] 为拒绝、撤回和下架的内容增加关联图片清理，处理网站存储与 GitHub 备份之间的关系。
- [ ] 增加图片完整解码、尺寸限制和重新编码，处理无效图片及不必要的元数据。
- [ ] 增加统一请求限流、站内账号封禁及举报处理；覆盖直接从 GitHub 同步回来的内容。
- [ ] 为普通网页补充 CSP、防嵌入等安全响应头及 HSTS。当前已有 `nosniff`、Referrer-Policy，上传图片另有独立 CSP，不能据此认为所有页面已有同等保护。
- [ ] 核实并记录 Railway 定时备份与恢复验证结果；目前线上配置状态未核实。

相关实现位于 [登录](../server/auth.mjs)、[社区接口](../server/community.mjs)、[上传存储](../server/submission-uploads.mjs)、[HTTP 服务](../server/server.mjs) 和 [图片下载校验](../scripts/lib/issue-images.mjs)。修改限制或公开规则时，应同时更新本文及使用者说明。

## 验证

运行 `npm test` 和 `npm run check`。测试覆盖 OAuth 回调、防伪请求、会话持久化、四种投稿、纠错版本、图片持久化与访问权限、评论和留言写入、去重、权限撤销、内容删除和旧投稿防恢复。自动化测试使用隔离的 GitHub 响应，不向真实仓库发布。

配置后，还应使用真实 GitHub 账号进行一次站内登录和留言提交验证。生产环境测试请使用明确标记的测试留言，完成后撤回，保留可追溯记录。

2026-10-03 的检查中，现有 40 项自动化测试通过；线上 HTTPS 跳转、匿名会话响应和受检敏感文件路径也已核对。该结果属于代码检查、隔离测试与线上只读验证，不是压力测试或完整渗透测试，也不代表上述待完成项已经实现。
