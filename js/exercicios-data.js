/* ============================================
   DataLife — Exercícios: biblioteca embutida
   ============================================
   Textos escritos para o DataLife (orientação geral; não substituem um
   profissional de educação física). Cada exercício da biblioteca tem uma
   animação (assets/exercicios/<id>.webp): as fotos de início e fim do
   movimento do Free Exercise DB (domínio público), em loop. O link que
   a pessoa colar (GIF, imagem ou YouTube) substitui a animação.
   ============================================ */

export const GRUPOS = [
  { id: 'peito', nome: 'Peito' },
  { id: 'costas', nome: 'Costas' },
  { id: 'ombros', nome: 'Ombros' },
  { id: 'biceps', nome: 'Bíceps' },
  { id: 'triceps', nome: 'Tríceps' },
  { id: 'antebraco', nome: 'Antebraço' },
  { id: 'abdomen', nome: 'Abdômen' },
  { id: 'quadriceps', nome: 'Quadríceps' },
  { id: 'posteriores', nome: 'Posteriores de coxa' },
  { id: 'gluteos', nome: 'Glúteos' },
  { id: 'panturrilhas', nome: 'Panturrilhas' }
];

export const EQUIPAMENTOS = ['Barra', 'Halteres', 'Máquina', 'Polia', 'Peso corporal', 'Kettlebell'];

const ex = (id, nome, grupo, equipamento, nivel, passos, dicas, erros, secundarios = []) =>
  ({ id, nome, grupo, equipamento, nivel, passos, dicas, erros, secundarios });

export const EXERCICIOS = [
  // ---------- Peito ----------
  ex('supino-reto', 'Supino reto com barra', 'peito', 'Barra', 'Iniciante', [
    'Deite no banco com olhos abaixo da barra e pés firmes no chão.',
    'Segure a barra um pouco mais aberto que os ombros e tire do suporte com os braços estendidos.',
    'Desça controlando até a barra tocar de leve a parte baixa do peito.',
    'Empurre de volta até estender os braços, sem travar os cotovelos com força.'
  ], ['Mantenha as escápulas juntas e "encaixadas" no banco durante toda a série.', 'Cotovelos a uns 45° do tronco protegem os ombros.'],
  ['Quicar a barra no peito.', 'Tirar o quadril do banco para empurrar mais peso.'], ['triceps', 'ombros']),
  ex('supino-inclinado-halteres', 'Supino inclinado com halteres', 'peito', 'Halteres', 'Iniciante', [
    'Ajuste o banco entre 30° e 45° e sente com um halter em cada coxa.',
    'Deite levando os halteres à altura do peito, palmas para a frente.',
    'Empurre para cima e um pouco para dentro, até quase encostar um no outro.',
    'Desça devagar até sentir o alongamento do peito.'
  ], ['Inclinação maior que 45° tira trabalho do peito e passa para os ombros.'], ['Descer pouco por medo do peso: use uma carga que permita amplitude.'], ['ombros', 'triceps']),
  ex('crucifixo-polia', 'Crucifixo na polia (crossover)', 'peito', 'Polia', 'Intermediário', [
    'Prenda as polias na altura dos ombros e dê um passo à frente, com um pé à frente do outro.',
    'Com cotovelos levemente flexionados, abra os braços até sentir o peito alongar.',
    'Feche os braços num arco, como se abraçasse uma árvore, até as mãos se encontrarem.',
    'Volte devagar, sem deixar o peso "puxar" os braços para trás.'
  ], ['O cotovelo fica fixo na mesma leve flexão: o movimento é do ombro.'], ['Transformar em supino, dobrando e estendendo o cotovelo.']),
  ex('flexao', 'Flexão de braço', 'peito', 'Peso corporal', 'Iniciante', [
    'Mãos no chão um pouco mais abertas que os ombros, corpo reto da cabeça aos pés.',
    'Contraia abdômen e glúteos para não deixar o quadril cair.',
    'Desça até o peito quase tocar o chão.',
    'Empurre o chão até estender os braços.'
  ], ['Fácil demais? Eleve os pés. Difícil? Apoie os joelhos ou as mãos num banco.'], ['Quadril caído ou empinado.', 'Cotovelos totalmente abertos, em "T".'], ['triceps', 'ombros', 'abdomen']),

  // ---------- Costas ----------
  ex('puxada-frente', 'Puxada frontal na polia', 'costas', 'Polia', 'Iniciante', [
    'Sente com as coxas presas sob o apoio e segure a barra mais aberto que os ombros.',
    'Incline o tronco levemente para trás e estufe o peito.',
    'Puxe a barra até a parte de cima do peito, levando os cotovelos para baixo e para trás.',
    'Volte controlando até estender os braços.'
  ], ['Pense em puxar com os cotovelos, não com as mãos.'], ['Balançar o tronco para trás para ajudar.', 'Puxar a barra atrás da nuca.'], ['biceps']),
  ex('remada-curvada', 'Remada curvada com barra', 'costas', 'Barra', 'Intermediário', [
    'Em pé, joelhos levemente flexionados, incline o tronco à frente com a coluna neutra.',
    'Segure a barra com as mãos na largura dos ombros, braços estendidos.',
    'Puxe a barra até a altura do umbigo, juntando as escápulas.',
    'Desça devagar mantendo o tronco na mesma inclinação.'
  ], ['Abdômen firme durante toda a série protege a lombar.'], ['Arredondar as costas.', 'Levantar o tronco a cada repetição.'], ['biceps', 'posteriores']),
  ex('remada-unilateral', 'Remada unilateral com halter', 'costas', 'Halteres', 'Iniciante', [
    'Apoie um joelho e a mão do mesmo lado num banco, coluna reta e paralela ao chão.',
    'Com a outra mão, segure o halter com o braço estendido.',
    'Puxe o halter em direção ao quadril, mantendo o cotovelo próximo ao corpo.',
    'Desça até alongar bem as costas.'
  ], ['Imagine colocar o halter no bolso de trás da calça.'], ['Girar o tronco para subir o peso.'], ['biceps']),
  ex('barra-fixa', 'Barra fixa', 'costas', 'Peso corporal', 'Avançado', [
    'Segure a barra com as palmas para a frente, mãos um pouco mais abertas que os ombros.',
    'Comece pendurado, braços estendidos, com os ombros "ativos" (afastados das orelhas).',
    'Puxe até o queixo passar a barra, levando o peito em direção a ela.',
    'Desça até estender os braços, sem soltar o corpo de uma vez.'
  ], ['Ainda não consegue? Use elástico de assistência ou faça só a descida, bem lenta.'], ['Balançar as pernas para subir.', 'Meia repetição, sem estender os braços.'], ['biceps', 'abdomen']),

  // ---------- Ombros ----------
  ex('desenvolvimento-halteres', 'Desenvolvimento com halteres', 'ombros', 'Halteres', 'Iniciante', [
    'Sente com as costas apoiadas e os halteres na altura das orelhas.',
    'Empurre para cima até quase estender os braços.',
    'Desça devagar até os halteres voltarem à altura das orelhas.'
  ], ['Antebraços na vertical em todo o movimento.'], ['Arquear muito a lombar para empurrar.'], ['triceps']),
  ex('elevacao-lateral', 'Elevação lateral', 'ombros', 'Halteres', 'Iniciante', [
    'Em pé, halteres ao lado do corpo, cotovelos levemente flexionados.',
    'Eleve os braços para os lados até a altura dos ombros.',
    'Desça devagar, sem deixar o halter "cair".'
  ], ['Carga leve e controle: é um músculo pequeno.', 'Suba como se derramasse uma jarra, com o mindinho um pouco mais alto.'], ['Subir acima da linha do ombro e usar o trapézio.', 'Dar impulso com o corpo.']),
  ex('crucifixo-inverso', 'Crucifixo inverso', 'ombros', 'Halteres', 'Intermediário', [
    'Incline o tronco à frente, coluna neutra, halteres pendurados abaixo do peito.',
    'Abra os braços para os lados, cotovelos levemente flexionados.',
    'Junte as escápulas no alto e desça devagar.'
  ], ['Trabalha a parte de trás do ombro, que costuma ficar fraca.'], ['Usar impulso do tronco.'], ['costas']),
  ex('face-pull', 'Face pull na polia', 'ombros', 'Polia', 'Intermediário', [
    'Prenda a corda na polia na altura do rosto e segure uma ponta em cada mão.',
    'Puxe a corda em direção ao rosto, separando as mãos e levando os cotovelos para trás e para cima.',
    'Segure um instante e volte devagar.'
  ], ['Ótimo para a postura e a saúde dos ombros de quem faz muito supino.'], ['Puxar com o corpo inclinado para trás.'], ['costas']),

  // ---------- Bíceps ----------
  ex('rosca-direta', 'Rosca direta com barra', 'biceps', 'Barra', 'Iniciante', [
    'Em pé, barra nas mãos com as palmas para a frente, na largura dos ombros.',
    'Com os cotovelos colados ao corpo, flexione os braços levando a barra ao peito.',
    'Desça devagar até estender os braços.'
  ], ['Cotovelos parados: só o antebraço se move.'], ['Balançar o tronco para levantar a barra.']),
  ex('rosca-alternada', 'Rosca alternada com halteres', 'biceps', 'Halteres', 'Iniciante', [
    'Em pé ou sentado, halteres ao lado do corpo com as palmas voltadas para dentro.',
    'Flexione um braço girando o punho para a palma ficar para cima no alto.',
    'Desça devagar e repita com o outro braço.'
  ], ['O giro do punho aumenta a contração do bíceps.'], ['Subir o cotovelo para a frente.']),
  ex('rosca-martelo', 'Rosca martelo', 'biceps', 'Halteres', 'Iniciante', [
    'Halteres ao lado do corpo com as palmas voltadas para dentro (pegada neutra).',
    'Flexione os braços sem girar os punhos.',
    'Desça devagar.'
  ], ['Trabalha também o braquial e o antebraço.'], ['Usar impulso.'], ['antebraco']),
  ex('rosca-scott', 'Rosca Scott', 'biceps', 'Máquina', 'Intermediário', [
    'Sente com a parte de trás dos braços apoiada no banco inclinado.',
    'Segure a barra ou os pegadores com as palmas para cima.',
    'Flexione os braços até a contração máxima e desça devagar, sem estender de forma brusca.'
  ], ['O apoio impede o "roubo" com o corpo.'], ['Soltar o peso no fim da descida, forçando o cotovelo.']),

  // ---------- Tríceps ----------
  ex('triceps-corda', 'Tríceps na polia com corda', 'triceps', 'Polia', 'Iniciante', [
    'De frente para a polia alta, segure a corda com os cotovelos colados ao corpo.',
    'Estenda os braços para baixo, abrindo as pontas da corda no final.',
    'Volte devagar até os antebraços passarem um pouco da linha horizontal.'
  ], ['Cotovelos fixos ao lado do corpo durante toda a série.'], ['Inclinar o tronco sobre a corda para empurrar.']),
  ex('triceps-frances', 'Tríceps francês com halter', 'triceps', 'Halteres', 'Intermediário', [
    'Sentado, segure um halter com as duas mãos acima da cabeça.',
    'Desça o halter atrás da cabeça flexionando os cotovelos.',
    'Estenda os braços de volta, sem abrir os cotovelos.'
  ], ['Alonga a cabeça longa do tríceps, que outros exercícios trabalham pouco.'], ['Cotovelos abertos para os lados.']),
  ex('mergulho-banco', 'Mergulho no banco', 'triceps', 'Peso corporal', 'Iniciante', [
    'Apoie as mãos na borda de um banco atrás de você, pernas estendidas à frente.',
    'Desça o corpo flexionando os cotovelos até uns 90°.',
    'Empurre de volta até estender os braços.'
  ], ['Joelhos flexionados deixam o exercício mais fácil.'], ['Descer demais e forçar a frente do ombro.'], ['peito', 'ombros']),
  ex('supino-fechado', 'Supino com pegada fechada', 'triceps', 'Barra', 'Intermediário', [
    'Deite no banco e segure a barra com as mãos na largura dos ombros.',
    'Desça a barra até a parte baixa do peito, cotovelos próximos ao corpo.',
    'Empurre até estender os braços.'
  ], ['Mãos coladas demais machucam o punho: largura dos ombros basta.'], ['Abrir os cotovelos, virando um supino comum.'], ['peito']),

  // ---------- Antebraço ----------
  ex('rosca-punho', 'Rosca de punho', 'antebraco', 'Barra', 'Iniciante', [
    'Sentado, apoie os antebraços nas coxas com as palmas para cima e os punhos para fora.',
    'Deixe a barra descer rolando até a ponta dos dedos.',
    'Feche as mãos e flexione os punhos o máximo possível.'
  ], ['Carga leve e muitas repetições.'], ['Levantar os antebraços das coxas.']),
  ex('rosca-punho-inversa', 'Rosca de punho inversa', 'antebraco', 'Barra', 'Iniciante', [
    'Mesma posição da rosca de punho, mas com as palmas para baixo.',
    'Eleve o dorso das mãos estendendo os punhos.',
    'Desça devagar.'
  ], ['Equilibra a força entre a parte de cima e a de baixo do antebraço.'], ['Usar carga demais e perder amplitude.']),
  ex('farmer-walk', 'Caminhada do fazendeiro', 'antebraco', 'Halteres', 'Iniciante', [
    'Segure um halter ou kettlebell pesado em cada mão, braços estendidos.',
    'Caminhe com passos curtos, tronco ereto e ombros para trás.',
    'Ande por 20 a 40 metros ou 30 a 60 segundos.'
  ], ['Treina a pegada e também abdômen e trapézio.'], ['Deixar os ombros caírem para a frente.'], ['abdomen']),
  ex('suspensao-barra', 'Suspensão na barra', 'antebraco', 'Peso corporal', 'Iniciante', [
    'Segure a barra fixa com as mãos na largura dos ombros.',
    'Fique pendurado com os braços estendidos e os ombros ativos.',
    'Segure o máximo de tempo com boa postura.'
  ], ['Comece com séries de 20 a 30 segundos.'], ['Relaxar totalmente os ombros, "pendurando" nas articulações.'], ['costas']),

  // ---------- Abdômen ----------
  ex('prancha', 'Prancha', 'abdomen', 'Peso corporal', 'Iniciante', [
    'Apoie antebraços e pontas dos pés no chão, cotovelos abaixo dos ombros.',
    'Mantenha o corpo reto, contraindo abdômen e glúteos.',
    'Segure a posição respirando normalmente.'
  ], ['Qualidade antes do tempo: 3 séries de 20 a 40 segundos bem feitas valem mais.'], ['Quadril alto ou caído.', 'Prender a respiração.'], ['ombros']),
  ex('abdominal-supra', 'Abdominal supra', 'abdomen', 'Peso corporal', 'Iniciante', [
    'Deite com os joelhos flexionados e os pés no chão.',
    'Com as mãos ao lado da cabeça, tire as escápulas do chão enrolando o tronco.',
    'Desça devagar sem relaxar totalmente.'
  ], ['O movimento é curto: não precisa sentar.'], ['Puxar o pescoço com as mãos.']),
  ex('elevacao-pernas', 'Elevação de pernas', 'abdomen', 'Peso corporal', 'Intermediário', [
    'Deite com as pernas estendidas e as mãos ao lado do corpo ou sob o quadril.',
    'Eleve as pernas até formar 90° com o tronco.',
    'Desça devagar sem deixar a lombar sair do chão.'
  ], ['Joelhos flexionados deixam mais fácil.'], ['Arquear a lombar na descida.']),
  ex('pallof-press', 'Pallof press na polia', 'abdomen', 'Polia', 'Intermediário', [
    'De lado para a polia na altura do peito, segure o pegador com as duas mãos junto ao peito.',
    'Afaste-se até sentir a tensão e estenda os braços à frente.',
    'Resista para o tronco não girar, segure e volte as mãos ao peito.'
  ], ['Treina o abdômen para estabilizar, que é a função dele no dia a dia.'], ['Deixar o tronco girar em direção à polia.']),

  // ---------- Quadríceps ----------
  ex('agachamento-livre', 'Agachamento livre', 'quadriceps', 'Barra', 'Intermediário', [
    'Barra apoiada no trapézio, pés na largura dos ombros e pontas levemente para fora.',
    'Desça levando o quadril para trás e para baixo, joelhos na direção das pontas dos pés.',
    'Desça até onde mantiver a coluna neutra (idealmente coxas paralelas ao chão).',
    'Suba empurrando o chão com o pé inteiro.'
  ], ['Inspire antes de descer e mantenha o abdômen firme.'], ['Joelhos para dentro na subida.', 'Calcanhar saindo do chão.'], ['gluteos', 'posteriores']),
  ex('leg-press', 'Leg press', 'quadriceps', 'Máquina', 'Iniciante', [
    'Sente com as costas e o quadril apoiados, pés na plataforma na largura dos ombros.',
    'Destrave e desça a plataforma flexionando os joelhos.',
    'Empurre de volta sem travar os joelhos no final.'
  ], ['Pés mais altos trabalham mais glúteos e posteriores.'], ['Descer tanto que o quadril sai do banco.'], ['gluteos']),
  ex('cadeira-extensora', 'Cadeira extensora', 'quadriceps', 'Máquina', 'Iniciante', [
    'Ajuste o encosto para o joelho ficar alinhado ao eixo da máquina.',
    'Estenda as pernas até ficarem retas.',
    'Desça devagar.'
  ], ['Segure um segundo no alto para mais contração.'], ['Dar tranco para subir.']),
  ex('afundo', 'Afundo (avanço)', 'quadriceps', 'Halteres', 'Iniciante', [
    'Em pé, dê um passo à frente.',
    'Desça até os dois joelhos ficarem perto de 90°, sem o de trás tocar o chão.',
    'Empurre com o pé da frente para voltar.'
  ], ['Tronco ereto e passo largo o bastante para o joelho da frente não passar muito do pé.'], ['Joelho da frente caindo para dentro.'], ['gluteos']),

  // ---------- Posteriores ----------
  ex('stiff', 'Stiff com barra', 'posteriores', 'Barra', 'Intermediário', [
    'Em pé, barra nas mãos à frente das coxas, joelhos levemente flexionados.',
    'Leve o quadril para trás deslizando a barra rente às pernas, coluna neutra.',
    'Desça até sentir o alongamento atrás das coxas.',
    'Volte contraindo glúteos e posteriores.'
  ], ['O movimento é do quadril, não da coluna.'], ['Arredondar as costas para descer mais.'], ['gluteos', 'costas']),
  ex('mesa-flexora', 'Mesa flexora', 'posteriores', 'Máquina', 'Iniciante', [
    'Deite de bruços com o apoio logo acima dos calcanhares.',
    'Flexione os joelhos trazendo os calcanhares em direção aos glúteos.',
    'Desça devagar.'
  ], ['Mantenha o quadril colado no banco.'], ['Levantar o quadril para ajudar.']),
  ex('cadeira-flexora', 'Cadeira flexora', 'posteriores', 'Máquina', 'Iniciante', [
    'Sente com o apoio sob as panturrilhas e o joelho alinhado ao eixo da máquina.',
    'Flexione os joelhos empurrando o apoio para baixo.',
    'Volte devagar.'
  ], ['Na posição sentada, o posterior trabalha mais alongado.'], ['Retorno rápido demais.']),
  ex('good-morning', 'Bom dia (good morning)', 'posteriores', 'Barra', 'Avançado', [
    'Barra no trapézio como no agachamento, joelhos levemente flexionados.',
    'Incline o tronco à frente levando o quadril para trás, coluna neutra.',
    'Volte à posição em pé contraindo glúteos e posteriores.'
  ], ['Comece com a barra vazia.'], ['Arredondar a lombar.'], ['gluteos', 'costas']),

  // ---------- Glúteos ----------
  ex('elevacao-pelvica', 'Elevação pélvica (hip thrust)', 'gluteos', 'Barra', 'Intermediário', [
    'Apoie as escápulas num banco, barra sobre o quadril (use uma proteção).',
    'Pés no chão na largura do quadril, joelhos flexionados.',
    'Eleve o quadril até o tronco ficar alinhado às coxas.',
    'Desça devagar.'
  ], ['No alto, as canelas ficam na vertical e o queixo levemente para baixo.'], ['Arquear a lombar no alto em vez de contrair o glúteo.'], ['posteriores']),
  ex('agachamento-sumo', 'Agachamento sumô', 'gluteos', 'Halteres', 'Iniciante', [
    'Pés bem afastados com as pontas para fora, halter seguro com as duas mãos.',
    'Desça mantendo os joelhos na direção das pontas dos pés.',
    'Suba contraindo os glúteos.'
  ], ['A base larga trabalha mais glúteos e adutores.'], ['Joelhos para dentro.'], ['quadriceps']),
  ex('abducao-maquina', 'Abdução na máquina', 'gluteos', 'Máquina', 'Iniciante', [
    'Sente com as costas apoiadas e as almofadas por fora dos joelhos.',
    'Afaste as pernas o máximo possível.',
    'Volte devagar, sem deixar os pesos baterem.'
  ], ['Inclinar levemente o tronco à frente aumenta o trabalho do glúteo.'], ['Movimento curto e rápido.']),
  ex('ponte-gluteo', 'Ponte de glúteo', 'gluteos', 'Peso corporal', 'Iniciante', [
    'Deite com os joelhos flexionados e os pés no chão.',
    'Eleve o quadril até alinhar joelhos, quadril e ombros.',
    'Segure um instante e desça.'
  ], ['Versão sem equipamento da elevação pélvica.'], ['Empurrar com a lombar.'], ['posteriores']),

  // ---------- Panturrilhas ----------
  ex('panturrilha-pe', 'Panturrilha em pé', 'panturrilhas', 'Máquina', 'Iniciante', [
    'Apoie a ponta dos pés num degrau, calcanhares para fora.',
    'Desça os calcanhares até sentir o alongamento.',
    'Suba o máximo possível na ponta dos pés e segure um instante.'
  ], ['Amplitude completa vale mais que carga.'], ['Movimento curto e quicado.']),
  ex('panturrilha-sentado', 'Panturrilha sentado', 'panturrilhas', 'Máquina', 'Iniciante', [
    'Sente com o apoio sobre as coxas, perto dos joelhos, e a ponta dos pés na plataforma.',
    'Desça os calcanhares e suba o máximo possível.'
  ], ['Com o joelho flexionado, trabalha mais o sóleo.'], ['Quicar no fundo do movimento.']),
  ex('panturrilha-unilateral', 'Panturrilha unilateral com halter', 'panturrilhas', 'Halteres', 'Iniciante', [
    'Em pé num degrau sobre um pé só, segure um halter do mesmo lado e se apoie com a outra mão.',
    'Desça o calcanhar e suba o máximo possível.'
  ], ['Corrige diferença de força entre as pernas.'], ['Apoiar demais na mão.']),
  ex('pular-corda', 'Pular corda', 'panturrilhas', 'Peso corporal', 'Iniciante', [
    'Segure a corda com os cotovelos próximos ao corpo.',
    'Gire a corda com os punhos e pule na ponta dos pés, saltos baixos.',
    'Faça séries de 30 a 60 segundos.'
  ], ['Bom aquecimento e condicionamento.'], ['Pular alto demais e cair com o pé inteiro.'])
];

/** Exercícios com animação embutida. */
const ANIMADOS = new Set(['supino-reto', 'supino-inclinado-halteres', 'crucifixo-polia', 'flexao', 'puxada-frente', 'remada-curvada', 'remada-unilateral', 'barra-fixa', 'desenvolvimento-halteres', 'elevacao-lateral', 'crucifixo-inverso', 'face-pull', 'rosca-direta', 'rosca-alternada', 'rosca-martelo', 'rosca-scott', 'triceps-corda', 'triceps-frances', 'mergulho-banco', 'supino-fechado', 'rosca-punho', 'rosca-punho-inversa', 'farmer-walk', 'prancha', 'abdominal-supra', 'elevacao-pernas', 'pallof-press', 'agachamento-livre', 'leg-press', 'cadeira-extensora', 'afundo', 'stiff', 'mesa-flexora', 'cadeira-flexora', 'good-morning', 'elevacao-pelvica', 'agachamento-sumo', 'abducao-maquina', 'ponte-gluteo', 'panturrilha-pe', 'panturrilha-sentado', 'panturrilha-unilateral', 'pular-corda']);
export const animacaoDe = id => (ANIMADOS.has(id) ? `assets/exercicios/${id}.webp` : '');
/** Quadro parado (posição final): para quem pediu menos movimento no sistema. */
export const paradoDe = id => (ANIMADOS.has(id) ? `assets/exercicios/${id}-parado.webp` : '');

/** Busca de vídeos no YouTube: sempre válida, para quem prefere ver alguém executando. */
export const videosDe = nome => `https://www.youtube.com/results?search_query=${encodeURIComponent(`como fazer ${nome} execução correta`)}`;
