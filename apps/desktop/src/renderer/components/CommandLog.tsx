import React from 'react'

interface LogEntry {
  id: number
  type: 'command' | 'response' | 'error'
  message: string
  timestamp: string
}

const CommandLog: React.FC = () => {
  // Placeholder - logs serão gerenciados via estado/contexto
  const logs: LogEntry[] = [
    { id: 1, type: 'response', message: 'Sistema inicializado com sucesso', timestamp: '00:00:00' },
    { id: 2, type: 'command', message: '"Gol time A"', timestamp: '00:00:01' },
    { id: 3, type: 'response', message: 'Placar atualizado: 1 x 0', timestamp: '00:00:02' }
  ]

  const getLogStyle = (type: LogEntry['type']) => {
    switch (type) {
      case 'command':
        return 'border-l-blue-500 bg-blue-500/10'
      case 'response':
        return 'border-l-green-500 bg-green-500/10'
      case 'error':
        return 'border-l-red-500 bg-red-500/10'
    }
  }

  const getTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'command':
        return '🎤'
      case 'response':
        return '💬'
      case 'error':
        return '❌'
    }
  }

  return (
    <div className="card-gaming p-6 flex flex-col">
      <h2 className="text-lg font-semibold text-slate-400 mb-4">📋 COMANDOS E RESPOSTAS</h2>
      
      <div className="flex-1 overflow-y-auto space-y-2 max-h-64">
        {logs.length === 0 ? (
          <div className="text-slate-500 text-center py-8">
            Nenhum comando registrado
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-lg border-l-4 ${getLogStyle(log.type)}`}
            >
              <div className="flex items-start gap-2">
                <span>{getTypeIcon(log.type)}</span>
                <div className="flex-1">
                  <p className="text-white text-sm">{log.message}</p>
                  <span className="text-xs text-slate-500">{log.timestamp}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Último comando destacado */}
      <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
        <p className="text-xs text-slate-400 mb-1">ÚLTIMO COMANDO:</p>
        <p className="text-white font-medium">"Gol time A"</p>
      </div>
    </div>
  )
}

export default CommandLog
