import React from 'react'

const Header: React.FC = () => {
  return (
    <header className="bg-slate-800 border-b border-slate-700 shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo e Título */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center glow-green">
            <span className="text-xl font-bold">⚽</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">E-Soccer Battle</h1>
            <p className="text-sm text-green-400">Volta 6 Minutos</p>
          </div>
        </div>
        
        {/* Status Indicador */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-slate-400">Sistema Pronto</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
