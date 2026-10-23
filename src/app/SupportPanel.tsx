import { Check, Copy, Download, Heart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { zhTW } from '../i18n/zh-TW'
import { trackSupport } from './analytics'

export function SupportPanel({ location, lang = 'zh', onDismiss, onShown }: {
  location: 'landing' | 'exam' | 'settings' | 'session'
  lang?: 'zh' | 'en'
  onDismiss?: () => void
  onShown?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState<'institution' | 'account' | null>(null)
  const [institution, account] = zhTW.landing.donateCode.split('-')
  const panel = useRef<HTMLElement>(null)
  const shown = useRef(false)
  const en = lang === 'en'
  useEffect(() => {
    if (!panel.current || shown.current) return
    const recordImpression = () => {
      if (shown.current) return
      shown.current = true
      trackSupport('shown', location)
      onShown?.()
    }
    if (!('IntersectionObserver' in window)) { recordImpression(); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        recordImpression()
        observer.disconnect()
      }
    }, { threshold: 0.5 })
    observer.observe(panel.current)
    return () => observer.disconnect()
  }, [location, onShown])
  const copy = async (field: 'institution' | 'account') => {
    try {
      await navigator.clipboard.writeText(field === 'institution' ? institution : account)
      setCopied(field)
      setMessage(en ? 'Copied. Continue in your payment app and check the recipient before confirming.' : `已複製${field === 'institution' ? '機構代碼' : '收款帳號'}，請到轉帳 App 核對收款人後再確認。`)
      trackSupport('copy_code', location)
    } catch {
      setMessage(en ? 'Select and copy the number manually.' : '無法自動複製，請長按數字手動複製。')
    }
  }
  return <section className="support-panel" ref={panel} aria-label={en ? 'Support Level Up' : '支持升級吧'}>
    <p className="eyebrow"><Heart size={15} /> {en ? 'Independently maintained' : '一個人維護，讓更多人練習。'}</p>
    <h2>{en ? 'Has Level Up helped you study?' : location === 'session' ? '升級吧，有幫上忙嗎？' : '讓好用的免費題庫，一直留在這裡。'}</h2>
    <p>{en ? 'I’m Jared. I maintain this question bank independently. Your support helps with question checks, image corrections and website upkeep. All study features remain free.' : '我是 Jared，這個題庫由我獨立維護。你的支持會用在題庫校對、圖片修正與網站維護。完全自願，不影響任何練習功能。'}</p>
    <button className="secondary-action" type="button" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) trackSupport('open', location) }}><Heart size={17} />{en ? 'Support via QR / transfer' : '掃碼或轉帳支持'}</button>
    {open ? <div className="support-payment">
      <strong>{en ? 'JKOPay receiving account · TWQR' : '街口收款帳戶 · TWQR'}</strong>
      <div className="support-payment-grid">
        <div className="support-qr-block">
          <img className="support-qr" src="/support/jkopay-twqr.svg" width="280" height="280" alt={en ? 'TWQR transfer code for Jared’s JKOPay receiving account' : 'Jared 街口收款帳戶的 TWQR 轉帳碼'} />
          <a className="secondary-action" href="/support/jkopay-receiving.jpg" download="levelup-jkopay-receiving.jpg" onClick={() => trackSupport('save_qr', location)}><Download size={16} />{en ? 'Save receiving QR' : '儲存收款碼圖片'}</a>
        </div>
        <div className="support-transfer">
          <p>{en ? 'Scan with JKOPay or an app supporting TWQR transfers. Choose your amount and check the recipient before confirming.' : '使用街口或支援 TWQR 轉帳的 App 掃碼，自行填寫支持金額，核對收款人後再確認。'}</p>
          <p>{en ? 'On the same phone, save the image and import it from your app’s scanner if supported. You can also enter the receiving details below.' : '在同一支手機上，可先儲存圖片，再從 App 的掃碼功能選取相簿（依 App 支援情況）。也可以輸入下方收款資料。'}</p>
          <dl className="support-account">
            <div><dt>{en ? 'Institution code' : '機構代碼（街口）'}</dt><dd><code>{institution}</code><button className="secondary-action" type="button" onClick={() => void copy('institution')}>{copied === 'institution' ? <Check size={16} /> : <Copy size={16} />}{en ? 'Copy code' : '複製代碼'}</button></dd></div>
            <div><dt>{en ? 'Receiving account' : '收款帳號'}</dt><dd><code>{account}</code><button className="secondary-action" type="button" onClick={() => void copy('account')}>{copied === 'account' ? <Check size={16} /> : <Copy size={16} />}{en ? 'Copy account' : '複製帳號'}</button></dd></div>
          </dl>
          <p>{en ? 'Any transfer fee is shown by your bank or payment app.' : '如有轉帳手續費，以銀行或支付 App 顯示為準。'}</p>
        </div>
      </div>
      <p role="status">{message || (en ? 'No payment is made on this website.' : '本站不會直接扣款，也不會取得你的付款資料。')}</p>
    </div> : null}
    {onDismiss ? <button className="support-dismiss" type="button" onClick={() => { trackSupport('dismiss', location); onDismiss() }}>{en ? 'Maybe later' : '下次再說'}</button> : null}
  </section>
}
