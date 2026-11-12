import {
  Car,
  CircuitBoard,
  Cog,
  Database,
  FlaskConical,
  Flame,
  Hammer,
  HardHat,
  HeartHandshake,
  Monitor,
  Plane,
  Scissors,
  ShieldCheck,
  Sparkles,
  Sprout,
  Store,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// One glyph per manifest category (Chinese key), shared by the landing and the
// /exams/ catalog so the same trade always reads with the same icon.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  商業服務: Store,
  餐飲食品: UtensilsCrossed,
  美容美髮: Scissors,
  車輛修護: Car,
  航空修護: Plane,
  照護服務: HeartHandshake,
  生活服務: Sparkles,
  資訊: Monitor,
  機械操作: Cog,
  電機工程: Zap,
  電子儀表: CircuitBoard,
  營造工程: HardHat,
  職業安全衛生: ShieldCheck,
  銲接配管: Flame,
  金屬及機械加工: Hammer,
  農業園藝: Sprout,
  化學工業: FlaskConical,
}

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICON[category] ?? Database
}
