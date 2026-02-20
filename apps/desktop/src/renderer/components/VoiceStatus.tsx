import React from 'react'

const VoiceStatus: React.FC = () => {
  // Placeholder - status será gerenciado via estado/contexto
  const isListening = false
  const isSpeaking = false
  const backendStatus = 'connected'

  return (
    <div className="card-gaming p-6 flex flex-col">
      <h2 className="text-lg font-semibold text-slate-400 mb-4">🎤 STATUS DE VOZ</h2>
      
      <div className="flex-1 flex flex-col gap-4">
        {/* Status do Microfone */}
        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
          <span className="text-slate-300">Microfone</span>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
            <span className={`text-sm ${isListening ? 'text-green-400' : 'text-slate-400'}`}>
              {isListening ? 'Escutando...' : 'Aguardando'}
            </span>
          </div>
        </div>
        
        {/* Status do TTS */}
        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
          <span className="text-slate-300">Narração</span>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-slate-500'}`}></div>
            <span className={`text-sm ${isSpeaking ? 'text-blue-400' : 'text-slate-400'}`}>
              {isSpeaking ? 'Falando...' : 'Silêncio'}
            </span>
          </div>
        </div>
        
        {/* Status do Backend */}
        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
          <span className="text-slate-300">Backend</span>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${backendStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-sm ${backendStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
              {backendStatus === 'connected' ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Botão de ação placeholder */}
      <button className="btn-primary mt-4 w-full" disabled>
        🎙️ Iniciar Reconhecimento de Voz
      </button>
    </div>
  )
}

export default VoiceStatus
