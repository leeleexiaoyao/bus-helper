# 小程序云开发接入说明

## 1. 当前项目状态

这个项目当前使用本地存储作为数据源：

- 启动入口在 `miniprogram/app.ts`
- 本地存储适配器在 `miniprogram/repositories/storage-adapter.ts`
- 业务数据统一保存在 `AppState`，定义在 `miniprogram/shared/types.ts`

这次改动已经补上了云开发入口和最小云函数骨架：

- 云开发配置：`miniprogram/config/cloud.ts`
- 云开发调用封装：`miniprogram/services/cloud/cloud-service.ts`
- 云函数目录：`cloudfunctions/getOpenid`

## 2. 开通真实云开发环境

1. 打开微信开发者工具。
2. 进入当前小程序项目。
3. 打开顶部的“云开发”面板。
4. 创建一个新的云开发环境，环境建议直接使用 `prod` 命名。
5. 记录环境 ID，格式通常类似 `prod-1gxxxxxxxxxxxxxxx`。

项目已经在 `project.config.json` 中声明了 `cloudfunctionRoot`，开发者工具会直接识别 `cloudfunctions/` 目录。

## 3. 填写环境 ID

把 `miniprogram/config/cloud.ts` 和 `miniprogram/config/cloud.js` 里的占位值：

```ts
replace-with-your-cloud-env-id
```

替换成真实环境 ID。

完成后重新编译，小程序启动日志会输出当前云环境连接状态。

## 4. 部署第一个云函数

当前仓库已经提供了一个最小可用的 `getOpenid` 云函数，用来验证：

- 小程序已经成功连接云开发环境
- 云函数部署成功
- 当前用户身份可以从云端拿到 `openid`

部署步骤：

1. 在微信开发者工具左侧找到 `cloudfunctions/getOpenid`。
2. 右键目录。
3. 执行“上传并部署：云端安装依赖”。

部署完成后，这个云函数就可以通过 `wx.cloud.callFunction` 调用了。

## 5. 小程序端调用方式

项目里已经准备好了调用封装。下面示例假设你在 `pages/home/index.ts` 这类页面文件里调用：

```ts
import { fetchCloudIdentity, getCloudDatabase } from "../../services/cloud/cloud-service";
```

示例：

```ts
const identity = await fetchCloudIdentity();
console.log(identity.openid);

const db = getCloudDatabase();
const users = await db.collection("users").get();
console.log(users.data);
```

## 6. 你的项目推荐数据模型

这个项目当前的本地结构很适合直接拆成 3 个集合：

- `users`
- `trips`
- `trip_members`

推荐映射关系：

- `users` 对应当前 `AppState.users`
- `trips` 对应当前 `AppState.trips`
- `trip_members` 对应当前 `AppState.tripMembers`
- `activeUserId` 保持本地会话字段，后续直接替换成当前登录用户的 `openid`

推荐字段：

### users

```json
{
  "_id": "openid",
  "nickname": "张三",
  "avatarUrl": "",
  "bio": "",
  "livingCity": "",
  "hometown": "",
  "age": "",
  "tags": [],
  "currentTripId": null,
  "isAuthorized": false,
  "createdAt": 0,
  "updatedAt": 0
}
```

### trips

```json
{
  "_id": "trip_xxx",
  "tripName": "深大返乡专线",
  "departureTime": "2026-05-01 09:00",
  "password": "123456",
  "templateId": "template-49",
  "creatorUserId": "openid",
  "status": "active",
  "seatCodes": [],
  "seatMap": {},
  "tools": {},
  "createdAt": 0,
  "updatedAt": 0
}
```

### trip_members

```json
{
  "_id": "trip_xxx_openid",
  "tripId": "trip_xxx",
  "userId": "openid",
  "role": "member",
  "joinedAt": 0
}
```

## 7. 迁移顺序

推荐按这个顺序迁移，风险最低：

1. 先接通云环境和 `getOpenid` 云函数。
2. 把用户资料读写迁到 `users` 集合。
3. 把创建车次、加入车次迁到云函数里处理。
4. 把座位分配和工具状态迁到 `trips` 集合。
5. 把 `tripMembers` 迁到 `trip_members` 集合。
6. 最后移除 `wxStorageAdapter` 的主数据职责，只保留少量本地缓存。

## 8. 业务实现建议

你这个项目适合采用下面这条边界：

- 读操作：小程序端直连云数据库
- 写操作：统一走云函数

这样密码校验、成员去重、抽号结果写入、投票提交这些关键流程都能在云端收口，数据一致性更稳。

## 9. 下一步建议

当前代码已经完成“云开发环境接入骨架”。下一步优先把这 3 个本地仓库替换成云端版本：

- `TripRepository`
- `UserRepository`
- `SessionRepository`

其中 `SessionRepository` 最适合直接切到 `openid + 本地缓存` 的组合模式。
