# 维护指南

通过网站的「投稿」页面，或仓库 Issues 的对应模板提交。可新增内容，也可报告取消、失效、价格变化和其他错误。每条信息需要公开且可核对的来源。

日常交流使用 Issues 中的「留言板」模板，标题保留 `[留言]` 前缀；图片可直接粘贴或拖入编辑框，回复使用 Issue 评论。留言不作为活动投稿自动收录。

## 内容放在哪里

| 类型 | 数据数组 | 必填内容 |
| --- | --- | --- |
| 校园活动 | `events` | `id`、`title`、`description`、`tags`、`organiser`、`startDate`、`time`、`location`、`price`、`source` |
| 学生权益 | `benefits` | `id`、`title`、`description`、`provider`、`eligibility`、`cost`、`validity`、`claim`、`source` |
| 生活提醒 | `notices` | `id`、`title`、`description`、`audience`、`action`、`source` |
| 美食推荐 | `foods` | `id`、`title`、`description`、`dishes`、`location`、`address`、`price`、`source` |

所有数组位于 `dist/data.js`。日期使用 `YYYY-MM-DD`；活动时间均为悉尼当地时间。

活动的 `title` 使用简洁易懂的中文名称；有英文原名时可写为「中文名称 · English Name」，并在 `name` 保留完整原名，方便搜索和核对官方通知。

一次性的冰淇淋发放属于活动；可持续领取的软件服务或优惠属于学生权益。餐厅属于美食推荐，一次性的夜市属于活动。

## 稳定链接与可选字段

`id` 使用小写英文、数字和连字符，同一数组内不能重复。内容更新时保留 ID，避免已有收藏链接和评论关联失效。每条内容的点赞和 GitHub 讨论均使用「类型 + ID」识别。

- 通用字段：`image`、`imageAlt`、`imageFit`、`imagePosition`、`imageSource`、`imageCredit`、`screenshot`、`note`、`sourceLabel`。图片放在 `dist/assets/`，数据填写相对路径。添加图片时同时填写简短的 `imageAlt`；第三方图片填写来源链接与作者，并在 `CREDITS.md` 记录许可。`imageFit` 默认 `cover`，菜单或海报可设为 `contain` 以保留完整画面。`imagePosition` 可填写 `50% 50%` 等焦点位置。首页、列表和详情共享同一条目的图片；无图时首页不显示缩略图，其他页面使用通用图标。
- 活动：`endDate` 为多日活动结束日；`registration` 和 `registrationLabel` 为报名入口；`audience` 为参加条件。`entryFree` 若填写，须与 `free` 标签一致。
- 权益：`claimUrl` 为领取或查询入口，`claimLabel` 可自定义按钮文字；`location`、`hours`、`mapUrl` 用于线下服务；`collectionSource` 为不同于领取入口的原始通知；`subtitle` 用于列表简介。
- 提醒：`effectiveDate` 为相关日期，没有固定日期可以省略。
- 美食：`name` 为店铺全名，`budget` 为价格详细说明，`hours` 为营业时间，`menuUrl` 为菜单，`verifiedAt` 为核对日期；`icon` 可选 `pizza`、`chicken`、`bowl`。
- 首页：每次打开或刷新时，权益、提醒、美食分别从有效条目中随机显示一条。可选 `expiresOn` 为首页展示截止日期（`YYYY-MM-DD`），按悉尼时间计算，截止当天仍可展示；没有截止日期的长期内容省略此字段。已失效或停止提供的内容设 `active: false`，会立即退出首页推荐池。没有有效条目时显示空状态，不回退到过期内容；列表与详情仍保留原条目。
- 提醒的 `effectiveDate` 是生效日期，不用于判断过期；例如一次性调钟提醒设置当天为 `expiresOn`，持续生效的规则不设截止日期。首页权益、提醒的 `homeSummary` 为卡片短摘要，建议两行以内。活动仍可用 `artwork: 'icecream'` 选择无图时的冰淇淋插图。新增内容和配图不需要修改页面代码。

例如新增社团活动：

```js
{
  id: 'club-walk-2026-10-20',
  title: '校园步行活动',
  description: '活动内容与参加方式。',
  tags: ['club', 'sports', 'free'],
  organiser: '主办社团全名',
  startDate: '2026-10-20',
  time: '14:00–16:00',
  location: '集合地点',
  price: '免费',
  entryFree: true,
  source: 'https://example.com/event'
}
```

以上仅为字段示例，不应直接收录。

## 活动标签

| 数据值 | 标签 |
| --- | --- |
| `club` | 社团 |
| `social` | 社交 |
| `learning` | 学习 |
| `career` | 职业 |
| `sports` | 运动 |
| `volunteering` | 公益 |
| `food` | 美食 |
| `music` | 音乐 |
| `free` | 免费 |
| `online` | 线上 |

至少一个标签，可多选。社团标签适用于学生社团主办或联合主办的活动，`organiser` 填写完整社团名；不能因为活动在校园或由 USU 组织就自动加上社团标签。免费指免费入场，收费项目须在 `price` 中写清楚。

不要根据某一次活动创建狭窄的专用标签。确需扩充标签时，同时更新 `data.js` 的 `tags` 和 `.github/ISSUE_TEMPLATE/new-event.yml` 的选项。

## 收录流程

1. 投稿者使用网站表单或 GitHub 模板填写内容与来源，配图直接上传到 Issue 的「配图」栏目。
2. 维护者核对日期、地点、价格、适用条件和配图；确认后添加 `审核通过` 标签。
3. 工作流自动校验、保存最多 3 张配图、更新网站数据与评论关联，并提交到 `main`。新条目 ID 为 `issue-<编号>`。
4. Issue 标记 `已收录` 并收到回执；Railway 接好 GitHub 自动部署后发布。失败则标记 `需补充`，补充后需要重新加审核标签。

纠错使用网站详情中的「纠错 / 补充」，表单会填入原信息；直接在 GitHub 可选择一个字段提交修改。保留原条目 ID，避免拆散已有点赞与评论。网站纠错还会检测原条目是否已更新，防止旧表单覆盖新的信息。

无需为了普通投稿手工修改代码。手工维护、修改标签或批量迁移时，仍可编辑 `dist/data.js`，运行 `npm run check` 和 `npm test` 后通过代码审查合并。

美食价格需说明是菜品价格还是人均预算，注明澳元、会员或优惠条件。不确定的价格写明待确认，不编造评分或亲测体验。请勿提交私人联系方式或未获授权的私人聊天截图。

仓库接入说明见 [README.md](README.md)。Issue 提交成功与网站收录是两个状态，审核通过后由工作流写入数据，部署完成后出现在列表。

不要手工覆盖 `dist/discussions.js`，也不要移除讨论 Issue 正文中的 `usyd-discussion` 标识。重跑同步工作流会复用已有讨论，不重复创建。
