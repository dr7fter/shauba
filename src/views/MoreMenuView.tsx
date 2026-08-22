import { motion } from 'framer-motion'
import { Calendar, HelpCircle, Library, Settings } from 'lucide-react'

type MoreMenuViewProps = {
  onNavigate: (view: string) => void
}

export function MoreMenuView({ onNavigate }: MoreMenuViewProps) {
  const menuItems = [
    {
      id: 'library',
      icon: Library,
      label: '题库浏览',
      description: '搜索、筛选和浏览所有题目',
    },
    {
      id: 'interval-review',
      icon: Calendar,
      label: '间隔复习管理',
      description: '高级复习调度工具：到期题、逾期债务、复习间隔配置',
    },
    {
      id: 'settings',
      icon: Settings,
      label: '设置',
      description: '主题、字号、目标配置、数据管理',
    },
    {
      id: 'help',
      icon: HelpCircle,
      label: '帮助文档',
      description: '使用指南与常见问题',
    },
  ]

  return (
    <motion.div
      className="more-menu-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <section className="more-menu-hero">
        <h1>更多功能</h1>
        <p>题库管理、高级工具与系统设置</p>
      </section>

      <div className="more-menu-grid">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <motion.button
              key={item.id}
              className="more-menu-item"
              onClick={() => onNavigate(item.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="more-menu-item-icon">
                <Icon size={24} />
              </div>
              <div className="more-menu-item-content">
                <h3>{item.label}</h3>
                <p>{item.description}</p>
              </div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}
