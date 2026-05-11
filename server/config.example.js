export default {
    HTTP_HOST: '0.0.0.0',   // 服务监听地址；0.0.0.0 允许局域网设备访问
    HTTP_PORT: '9505',      // 服务监听端口
    SESSION_ID: 'local',    // 会话标识；本地架构下任意字符串都行
    SESSION_PASSWORD: '',   // 远程网页访问密码；留空则不需要登录校验
    PLAYWRIGHT_BROWSER_CHANNEL: 'chrome', // Playwright 独立浏览器通道，常用值 chrome / msedge / chromium
    BROWSER_EXTENSION_HOST: '127.0.0.1',  // 本地浏览器扩展 bridge 监听地址，通常不用改
    BROWSER_EXTENSION_PORT: '17373',      // 本地浏览器扩展 bridge 监听端口，需和扩展弹窗里的端口一致
    DEBUG: '0', // 调试日志开关；写 1 会打印 WebSocket 收包摘要
};
