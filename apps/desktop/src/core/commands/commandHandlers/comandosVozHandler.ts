/**
 * ComandosVoz Handler - Lists available voice commands
 * Single Responsibility: Only provides help information
 */

export interface ComandosVozResult {
  success: boolean;
  commands: string[];
  message: string;
}

export async function handleComandosVoz(): Promise<ComandosVozResult> {
  const commands = [
    'Volta seis - Inicia nova partida de 6 minutos',
    'Resultado - Anuncia o placar atual',
    'Intervalo - Pausa ou retoma a partida',
    'Dúvida agora - Marca momento para revisão',
    'Encerrar - Finaliza a partida',
    'Comandos de voz - Lista os comandos disponíveis',
    'Gol para o time A - Adiciona um ponto para o Time A',
    'Gol para o time B - Adiciona um ponto para o Time B',
  ];

  return {
    success: true,
    commands,
    message: 'Comandos disponíveis: volta seis, resultado, intervalo, dúvida agora, encerrar, gol para o time A, gol para o time B, e comandos de voz.',
  };
}
