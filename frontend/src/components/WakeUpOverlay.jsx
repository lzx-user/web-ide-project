// Render 冷启动遮罩
export default function WakeUpOverlay({ visible }) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
      <h3 className="text-xl font-bold text-gray-800 tracking-wide">
        正在唤醒云端协作服务...
      </h3>
      <p className="text-sm text-gray-500 mt-3 font-medium">
        由于免费实例限制，首次唤醒可能需要 30 ~ 50 秒，请耐心稍候 ☕️
      </p>
    </div>
  );
}