import type { QrCodeItem } from '../../../types/resume';

interface QrCodesPreviewProps {
  items: QrCodeItem[];
}

/**
 * 简历内嵌二维码区块 — 简化版。
 * XINGTU 的简历二维码在「分享」功能里做（页面层生成），这里保留组件签名兼容模板，
 * 但暂不渲染内嵌二维码（需要时可接 qrcode 库启用）。
 */
export function QrCodesPreview({ items }: QrCodesPreviewProps) {
  // 简历模板中的二维码区块：XINGTU 暂不内嵌展示（分享链接的二维码在分享面板里生成）
  void items
  return null
}
