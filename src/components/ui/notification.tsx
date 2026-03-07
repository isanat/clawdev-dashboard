'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, X, AlertCircle, Info } from 'lucide-react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  visible: boolean
  onClose: () => void
}

export function Toast({ message, type = 'success', visible, onClose }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [visible, onClose])

  if (!visible) return null

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />
  }

  const colors = {
    success: 'border-green-500/30 bg-green-500/10',
    error: 'border-red-500/30 bg-red-500/10',
    info: 'border-blue-500/30 bg-blue-500/10'
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg ${colors[type]}`}>
        {icons[type]}
        <span className="text-sm font-medium text-foreground">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Toast Context for global use
import { createContext, useContext, ReactNode } from 'react'

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as const })

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type })
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    return { showToast: () => {} }
  }
  return context
}
