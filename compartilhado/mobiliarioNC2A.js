// Mobiliário posicionável, com circulação frontal livre para todas as portas.
const TODOS = Object.freeze({
  mesa: 'office-desk.obj', cadeira: 'office-chair.obj',
  computador: 'computador2.obj', luminaria: 'ceiling-lamp.obj',
  lousa: 'lousa.obj', mesaReuniao: 'mesa-google.obj',
  pufe: 'pufe.obj', radio: 'radio.obj', lixeira: 'lixeira.obj'
});

export function gerarMobiliarioSala(sala, andar) {
  if (sala.gerarMobiliario === false) return [];
  const area = sala.area;
  const ancora = sala.ancora;
  if (!area && !ancora) return [];
  const c = area ? (area.minX + area.maxX) / 2 : ancora.x;
  const zPositivo = area ? area.minZ > 0 : ancora.z > 0;
  const centroZ = area ? (area.minZ + area.maxZ) / 2 : ancora.z;
  const y = ancora?.y ?? (andar === 'Andar01' ? 4 : 0);
  const largura = area ? area.maxX - area.minX : 6;
  const profundidade = area ? area.maxZ - area.minZ : 7;
  const lado = zPositivo ? 1 : -1;
  const objetos = [];
  function colocar(id, modelo, x, yy, z, extras = {}) {
    objetos.push({
      nome: extras.nome ?? `${andar}_${sala.nome}_${id}`, modelo,
      andar, sala: sala.nome, x, y: yy, z, rotacaoY: extras.rotacaoY ?? 0,
      solido: extras.solido ?? false,
      interativo: extras.interativo ?? false,
      item: extras.item ?? false, podePegar: extras.podePegar ?? false,
      cor: extras.cor ?? [1, 1, 1], ehBloco: extras.ehBloco ?? false,
      tamanho: extras.tamanho ?? 0.8
    });
  }
  // Ninguém deve colocar móveis nos primeiros ~2m após a soleira.
  if (area && (largura < 4.2 || profundidade < 5.5)) return [];
  if (sala.categoria === 'circulacao' || sala.categoria === 'banheiro') return [];
  const distanciaFundo = 1.55;
  const paredeFundo = zPositivo ? (area?.maxZ ?? centroZ + 2.5) : (area?.minZ ?? centroZ - 2.5);
  const zMesa = paredeFundo - lado * distanciaFundo;
  const distanciaX = largura >= 9 ? Math.min(2.8, largura / 4) : largura >= 6 ? 1.55 : 0;
  const offsets = distanciaX ? [-distanciaX, distanciaX] : [0];
  if (sala.categoria === 'copa') {
    colocar('mesa_copa', TODOS.mesaReuniao, c, y, centroZ + lado * 0.7, {solido:true});
    colocar('lixeira_copa', TODOS.lixeira, (area?.maxX ?? c+2) - 0.8, y, paredeFundo - lado*0.8,{solido:true});
  } else {
    for (const [i, dx] of offsets.entries()) {
      const base = `posto_${i+1}`;
      const x = c + dx;
      colocar(base+'_mesa', TODOS.mesa, x, y, zMesa, {solido:true,
        nome: sala.nomesMobiliario?.mesa && i === 0 ? sala.nomesMobiliario.mesa : undefined,
        interativo: i===0 && (sala.interativos??[]).includes('mesa')});
      colocar(base+'_cadeira', TODOS.cadeira, x, y, zMesa-lado*1.1,
        {solido:true,rotacaoY:zPositivo?Math.PI:0,
        nome: sala.nomesMobiliario?.cadeira && i === 0 ? sala.nomesMobiliario.cadeira : undefined});
      colocar(base+'_computador', TODOS.computador, x, y+0.74, zMesa,
        {nome: sala.nomesMobiliario?.computador && i === 0 ? sala.nomesMobiliario.computador : undefined});
    }
    // Área de convivência somente em salas largas, ao fundo e longe do acesso.
    if (largura >= 11 && sala.categoria !== 'sala_aula') {
      colocar('pufe', TODOS.pufe, c, y, paredeFundo-lado*1.25);
    }
  }
  colocar('luminaria', TODOS.luminaria, c, y+3, centroZ,
    {nome:sala.nomesMobiliario?.lampada});
  // Respeita os objetos específicos já existentes na Sala002 (rádio, lixo, task).
  const angulo = ancora?.rotacaoY ?? 0;
  for (const obj of sala.objetos ?? []) {
    const dx = obj.dx ?? 0, dz = obj.dz ?? 0;
    const px = ancora ? ancora.x + dx*Math.cos(angulo) + dz*Math.sin(angulo) : c+dx;
    const pz = ancora ? ancora.z - dx*Math.sin(angulo) + dz*Math.cos(angulo) : centroZ+dz;
    colocar(obj.id ?? obj.nome, obj.modelo ?? null, px, y+(obj.dy??0), pz,
      {...obj, nome:obj.nome, rotacaoY:angulo+(obj.rotacaoY??0)});
  }
  return objetos;
}
