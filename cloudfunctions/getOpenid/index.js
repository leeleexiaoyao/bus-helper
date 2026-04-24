const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (_event, context) => {
  const wxContext = cloud.getWXContext();

  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || null,
    env: wxContext.ENV || null,
    requestId: context?.requestId || null,
    serverTime: Date.now()
  };
};
