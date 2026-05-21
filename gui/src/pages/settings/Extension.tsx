import SubHeader from '../../components/SubHeader';
import { useConnectionStatus } from '../../components/ConnectionStatus';

export default function Extension() {
  const status = useConnectionStatus();
  return (
    <div className="flex flex-col h-full">
      <SubHeader title="浏览器插件" />
      <div className="p-4 space-y-4">
        <div className={`p-4 rounded-xl ${status.extension ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          <div className="flex items-center gap-2 font-medium">
            <span className={`w-2 h-2 rounded-full ${status.extension ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {status.extension ? '插件已连接' : '插件未连接'}
          </div>
          <p className="text-sm text-neutral-600 mt-2">
            {status.extension
              ? '你的分身正在常驻运行，可以接收别人发来的消息并自动处理。'
              : '没有插件，关掉网页后分身就停了。装上插件，Chrome 开着分身就一直在。'}
          </p>
        </div>

        {!status.extension && (
          <div className="bg-white rounded-xl p-4 space-y-3">
            <div className="font-medium">安装步骤</div>
            <ol className="space-y-2 text-sm text-neutral-600 list-decimal pl-5">
              <li>下载插件压缩包</li>
              <li>访问 <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-[13px]">chrome://extensions</code></li>
              <li>开启「开发者模式」</li>
              <li>点「加载已解压的扩展程序」，选择解压后的目录</li>
              <li>在 Chrome 工具栏打开 Meem 插件，使用相同账号登录</li>
            </ol>
            <a
              href="/extension.zip"
              className="block w-full h-11 leading-[44px] text-center bg-accent text-white rounded-[10px] font-semibold mt-2"
              download="meem-extension.zip"
            >
              下载插件
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
