/* ============================================
   DataLife — Conselhos: conteúdo
   ============================================
   Texto próprio, em linguagem direta. HTML estático escrito aqui (não vem
   de usuário), por isso pode usar <strong>/<em>. Ferramentas interativas
   são montadas por conselhos.js nos pontos marcados com `ferramenta`.
   Não é recomendação de investimento: são princípios gerais.
   ============================================ */

export const TOPICOS = [
  {
    id: 'organizar',
    titulo: 'Organizar as finanças',
    icone: 'sliders',
    resumo: 'Um orçamento só para a casa toda, dividido em seis partes: custos fixos 30%, conforto 15%, metas 15%, prazeres 10%, liberdade financeira 25% e conhecimento 5%. Valores exatos, lançados toda semana.',
    secoes: [
      { titulo: 'Um orçamento para a casa toda', html: `<p>O orçamento é da <strong>família</strong>, não de cada um: todos os ganhos e todos os gastos da casa entram no mesmo lugar. Vale para quem mora sozinho, para o casal e para os filhos a partir dos 12 anos, que já podem acompanhar e entender para onde o dinheiro vai.</p>
        <p>Assim ninguém paga a conta "do outro" sem saber, e as decisões grandes (trocar de carro, viajar, mudar de casa) partem dos mesmos números.</p>` },
      { titulo: 'A divisão sugerida', html: `<ul>
          <li><strong>Custos fixos, 30%</strong>: moradia, contas da casa, mercado, transporte, saúde, escola.</li>
          <li><strong>Conforto, 15%</strong>: o que vai além do necessário, como um carro mais caro do que você precisa, delivery, assinaturas, upgrades do dia a dia.</li>
          <li><strong>Metas, 15%</strong>: dinheiro separado para objetivos com data, como viagens, presentes de fim de ano, troca de carro.</li>
          <li><strong>Prazeres, 10%</strong>: a cerveja, o churrasco, o refrigerante, o restaurante, o passeio.</li>
          <li><strong>Liberdade financeira, 25%</strong>: investimentos de longo prazo, para o seu "eu do futuro".</li>
          <li><strong>Conhecimento, 5%</strong>: cursos, livros, certificações, idiomas.</li>
        </ul>
        <p>É o padrão do Orçamento do DataLife (em <em>Minhas metas</em>). Veja quanto isso dá com a sua renda:</p>`, ferramenta: 'divisao' },
      { titulo: 'As regras que seguram o orçamento', html: `<ul>
          <li><strong>Custos fixos em no máximo 40%.</strong> Acima disso, o risco de descontrole no futuro é enorme: qualquer imprevisto ou queda de renda não cabe mais, e a conta vai para o cartão.</li>
          <li><strong>Não tire de Liberdade financeira nem de Prazeres</strong> para aumentar as outras partes. Se precisar de mais espaço, corte primeiro o Conforto.</li>
          <li><strong>Prazeres não deveria passar de 10%.</strong> Se aumentar os prazeres, diminua as metas na mesma medida.</li>
          <li><strong>Prazeres e metas mantêm a qualidade de vida</strong>: um orçamento sem nenhum dos dois não se sustenta por muito tempo.</li>
          <li><strong>25% em liberdade financeira</strong> significa que, a cada <strong>4 anos</strong> investindo, você garante <strong>1 ano</strong> de vida do seu eu do futuro (4 × 25% = 100% de um ano de renda), antes mesmo de contar os rendimentos.</li>
          <li><strong>Até cerca de R$ 50 mil de renda por mês</strong> a divisão faz sentido como está. Acima disso, os custos fixos tendem a pesar bem menos que 30%, e a diferença deve ir para a liberdade financeira.</li>
        </ul>` },
      { titulo: 'Onde fica cada dinheiro', html: `<ul>
          <li><strong>Reserva de emergência</strong>: de 6 a 12 meses dos seus gastos fixos, na <strong>poupança</strong> de um banco com agência física em todo o país (como Itaú, Bradesco, Banco do Brasil e Caixa). Veja o guia <a href="#reserva">Reserva de emergência</a>.</li>
          <li><strong>Dinheiro das metas</strong>: aplicado em algo que dê para <strong>resgatar na hora</strong>, mas que <strong>renda mais que a poupança</strong>, como CDB com liquidez diária ou Tesouro Selic.</li>
          <li><strong>Liberdade financeira</strong>: investimentos de longo prazo, que você não pretende tocar. Veja o guia <a href="#liberdade">Liberdade financeira</a>.</li>
        </ul>` },
      { titulo: 'O hábito', html: `<ul>
          <li><strong>Sempre valores exatos</strong>, com centavos. Arredondar "para facilitar" acumula diferença e o mês nunca fecha.</li>
          <li><strong>Lance os gastos toda semana</strong>, num dia fixo (domingo à noite, por exemplo). Esperar o fim do mês faz esquecer gastos e descobrir o estouro tarde demais.</li>
        </ul>` }
    ],
    fazer: [
      ['org-familia', 'Juntar todos os ganhos e gastos da casa num orçamento só'],
      ['org-metas', 'Definir a divisão em Orçamento → Minhas metas'],
      ['org-fixos', 'Conferir se os custos fixos estão em até 40% da renda'],
      ['org-lugares', 'Separar onde fica a reserva, o dinheiro das metas e o de longo prazo'],
      ['org-semana', 'Escolher um dia da semana para lançar os gastos'],
      ['org-exatos', 'Lançar os valores exatos, com centavos']
    ]
  },
  {
    id: 'reserva',
    titulo: 'Reserva de emergência',
    icone: 'shield',
    resumo: 'De 6 a 12 meses dos seus gastos fixos, na poupança de um banco com agência física em todo o país, para sacar no mesmo dia. Vem antes de qualquer outro investimento.',
    secoes: [
      { titulo: 'Para que serve', html: '<p>É o dinheiro que paga as contas quando a renda some ou um gasto grande aparece: demissão, doença, conserto do carro. Com ela, um imprevisto não vira dívida no cartão ou no cheque especial, que têm os juros mais altos do mercado.</p>' },
      { titulo: 'Quanto guardar', html: '<p>A referência é de <strong>6 a 12 meses dos seus gastos fixos</strong> (moradia, contas, mercado, transporte, saúde, escola). Quem tem renda variável, é autônomo ou é o único que sustenta a casa deve mirar perto dos 12 meses.</p>', ferramenta: 'reserva' },
      { titulo: 'Onde guardar', html: `<ul>
          <li><strong>Na poupança de um banco com agência física em todo o país</strong>, como Itaú, Bradesco, Banco do Brasil e Caixa. Em uma emergência, ter atendimento presencial perto de você faz diferença; para a reserva, prefira esses bancos aos 100% digitais.</li>
          <li><strong>Resgate na hora</strong>: o dinheiro da poupança sai no mesmo instante, sem carência, sem imposto de renda e sem taxa.</li>
          <li><strong>Garantia do FGC</strong>: a poupança tem a proteção do Fundo Garantidor de Créditos até <strong>R$ 250 mil por CPF por instituição</strong>. Acima disso, divida entre bancos.</li>
          <li><strong>A reserva não é para render</strong>: é para estar lá quando precisar. O dinheiro das <em>metas</em> (viagem, presentes) é que pode ir para algo com resgate imediato que renda mais que a poupança, como CDB com liquidez diária ou Tesouro Selic.</li>
          <li><strong>Fora da reserva</strong>: ações, fundos imobiliários, cripto e qualquer coisa com carência ou que oscile de preço.</li>
        </ul>` },
      { titulo: 'Como montar', html: '<p>Comece com uma meta menor (um mês de gastos) para criar o hábito, depois avance. Trate o aporte como uma conta fixa: no Orçamento, ele cabe na categoria <em>Metas</em>. Usou a reserva? A prioridade passa a ser recompô-la.</p>' }
    ],
    fazer: [
      ['res-calc', 'Calcular meus gastos fixos mensais'],
      ['res-meta', 'Criar o objetivo "Reserva de emergência" no DataLife'],
      ['res-local', 'Abrir ou escolher a poupança num banco com agência física em todo o país'],
      ['res-auto', 'Programar o aporte mensal logo depois de receber'],
      ['res-1mes', 'Chegar a 1 mês de gastos guardados'],
      ['res-6meses', 'Chegar a 6 meses de gastos guardados']
    ]
  },
  {
    id: 'compra',
    titulo: 'Carro, casa, moto ou caminhão',
    icone: 'car',
    resumo: 'Antes de assinar, compare quanto você paga no total em cada forma: à vista, financiamento, consórcio, juntando ou alugando. A parcela que cabe no mês não é o custo real.',
    secoes: [
      { titulo: 'As formas de comprar', html: `<ul>
          <li><strong>À vista</strong>: o mais barato quando você já tem o dinheiro, e ainda permite pedir desconto. Mas não use a reserva de emergência para isso.</li>
          <li><strong>Financiamento</strong>: o bem é seu na hora, e você paga juros sobre todo o prazo. Olhe o <strong>CET</strong> (Custo Efetivo Total), não só a taxa de juros: ele inclui seguros e tarifas.</li>
          <li><strong>Consórcio</strong>: não tem juros, mas tem taxa de administração (e às vezes fundo de reserva e seguro). Você só recebe o bem quando é contemplado (sorteio ou lance), o que pode levar anos.</li>
          <li><strong>Juntar e comprar à vista</strong>: você guarda a parcela e o dinheiro rende a seu favor. Costuma ser o caminho mais barato, em troca de esperar.</li>
          <li><strong>Alugar ou assinar</strong>: sem entrada, sem manutenção pesada e sem desvalorização; o dinheiro que seria da compra pode ficar investido. Em compensação, o bem nunca é seu.</li>
        </ul>` },
      { titulo: 'Simule a sua compra', html: '<p>Preencha com os números da proposta que você recebeu. A comparação mostra o total pago e o custo de oportunidade: quanto o dinheiro renderia se ficasse investido.</p>', ferramenta: 'compra' },
      { titulo: 'O que costuma pesar', html: `<ul>
          <li><strong>Carro e moto desvalorizam</strong>, mais nos primeiros anos. Financiar algo que perde valor enquanto você paga juros é o pior dos dois lados.</li>
          <li><strong>Custos de ter</strong>: IPVA, seguro, manutenção e combustível no veículo; IPTU, condomínio, manutenção e ITBI/escritura no imóvel. Some ao custo mensal antes de decidir.</li>
          <li><strong>Caminhão é ferramenta de trabalho</strong>: a conta é se o frete paga a parcela, os custos e a sua renda com folga, inclusive nos meses fracos.</li>
          <li><strong>Imóvel</strong>: financiamentos longos chegam a pagar mais de uma vez o valor do imóvel em juros. Amortizar antes (reduzindo o prazo) economiza muito.</li>
        </ul>` }
    ],
    fazer: [
      ['com-total', 'Comparar o total pago, não só a parcela'],
      ['com-cet', 'Pedir o CET por escrito no financiamento'],
      ['com-custos', 'Somar os custos de manter o bem (impostos, seguro, manutenção)'],
      ['com-reserva', 'Garantir que a reserva de emergência fica intacta depois da compra']
    ]
  },
  {
    id: 'cartao',
    titulo: 'Cartão de crédito',
    icone: 'wallet',
    resumo: 'Pague sempre a fatura inteira. O cartão é ótimo como meio de pagamento e péssimo como empréstimo: rotativo e parcelamento da fatura estão entre os juros mais caros do país.',
    secoes: [
      { titulo: 'As regras que evitam dor de cabeça', html: `<ul>
          <li><strong>Pague o total da fatura</strong>, todo mês. Pagar o mínimo joga o resto no rotativo.</li>
          <li><strong>O limite não é renda</strong>: gaste só o que já cabe no orçamento do mês.</li>
          <li><strong>Parcelado sem juros também compromete</strong>: as parcelas futuras somam e comem a renda dos próximos meses. Some tudo antes de parcelar de novo.</li>
          <li><strong>Pontos e cashback não compensam juros</strong>: valem só para quem paga a fatura inteira.</li>
          <li>Use a <strong>data de melhor compra</strong> (uns dias antes do vencimento) para ter mais prazo, e o <strong>cartão virtual</strong> nas compras pela internet.</li>
        </ul>` },
      { titulo: 'Se a fatura não fechar', html: '<p>Desde janeiro de 2024, a <strong>Lei 14.690/2023</strong> limita os juros e encargos do rotativo e do parcelamento da fatura a <strong>100% do valor original da dívida</strong>. Ainda assim é caro: troque essa dívida por um crédito mais barato (consignado ou pessoal com taxa menor) e corte o uso do cartão até quitar.</p>' },
      { titulo: 'Anuidade', html: '<p>Negocie: muitos bancos isentam a anuidade para quem pede ou atinge um gasto mínimo. Se não compensar, existem cartões sem anuidade.</p>' }
    ],
    fazer: [
      ['car-total', 'Configurar o pagamento automático do valor total da fatura'],
      ['car-data', 'Anotar a data de melhor compra de cada cartão'],
      ['car-parcelas', 'Somar as parcelas que já estão comprometidas nos próximos meses'],
      ['car-anuidade', 'Negociar ou zerar a anuidade'],
      ['car-virtual', 'Usar cartão virtual nas compras online']
    ]
  },
  {
    id: 'dividas',
    titulo: 'Sair das dívidas',
    icone: 'trending',
    resumo: 'Liste tudo, pare de criar dívida nova, negocie e ataque uma de cada vez: a de juros mais altos primeiro (avalanche) ou a menor primeiro (bola de neve).',
    secoes: [
      { titulo: 'Passo a passo', html: `<ol>
          <li><strong>Liste tudo</strong>: credor, saldo, juros ao mês e parcela. Não dá para resolver o que você não vê.</li>
          <li><strong>Pare de criar dívida nova</strong>: guarde o cartão e corte o cheque especial.</li>
          <li><strong>Garanta o essencial</strong>: moradia, contas básicas e alimentação vêm antes. Dívidas com garantia (como financiamento de veículo ou imóvel) também, porque você pode perder o bem.</li>
          <li><strong>Negocie</strong>: bancos e lojas costumam dar desconto grande para quitar à vista. Os mutirões e plataformas oficiais de renegociação (como o Desenrola, quando aberto, e os feirões de limpa nome) ajudam.</li>
          <li><strong>Troque dívida cara por barata</strong>: consignado ou crédito com garantia têm juros bem menores que cartão e cheque especial.</li>
          <li><strong>Ataque uma de cada vez</strong>, pagando o mínimo nas outras.</li>
        </ol>` },
      { titulo: 'Avalanche ou bola de neve?', html: '<p><strong>Avalanche</strong>: quita primeiro a de maior juro. É a que paga menos juros no total. <strong>Bola de neve</strong>: quita primeiro a de menor saldo. Você elimina dívidas mais rápido, e a motivação ajuda a não desistir. A melhor é a que você consegue seguir.</p>', ferramenta: 'dividas' }
    ],
    fazer: [
      ['div-lista', 'Listar todas as dívidas com saldo e juros'],
      ['div-parar', 'Parar de usar cartão e cheque especial até quitar'],
      ['div-negociar', 'Negociar a dívida mais cara'],
      ['div-metodo', 'Escolher o método (avalanche ou bola de neve) e a primeira dívida'],
      ['div-quitar', 'Quitar a primeira dívida']
    ]
  },
  {
    id: 'golpes',
    titulo: 'Como não cair em golpes',
    icone: 'lock',
    resumo: 'Banco não liga pedindo senha, código ou transferência "de teste". Na dúvida, desligue e ligue você para o número oficial. Pressa e urgência são a assinatura do golpe.',
    secoes: [
      { titulo: 'Os golpes mais comuns', html: `<ul>
          <li><strong>Falsa central do banco</strong>: ligam dizendo que houve compra suspeita e pedem senha, código do SMS ou que você transfira o dinheiro para uma "conta segura". O banco nunca faz isso.</li>
          <li><strong>Parente ou amigo com número novo</strong> no WhatsApp pedindo Pix urgente. Ligue para o número antigo antes de qualquer coisa.</li>
          <li><strong>Pix "enviado por engano"</strong>: alguém pede para você devolver. Não devolva por conta própria; o estorno deve ser feito pelo banco.</li>
          <li><strong>Boleto falso</strong>: antes de pagar, confira o nome do beneficiário e o CNPJ na tela de confirmação.</li>
          <li><strong>Links em SMS, e-mail e anúncios</strong> com "prêmio", "pendência" ou "bloqueio". Acesse sempre pelo app ou digitando o endereço.</li>
          <li><strong>Investimento com retorno garantido e alto</strong>, ou que paga por indicar outras pessoas: é pirâmide.</li>
          <li><strong>Loja com preço muito abaixo</strong>: confira CNPJ, endereço e reputação antes de pagar, e prefira cartão (dá para contestar) a Pix.</li>
        </ul>` },
      { titulo: 'Caiu em um golpe pelo Pix?', html: '<p>Avise o seu banco <strong>na hora</strong> e peça a abertura do <strong>MED (Mecanismo Especial de Devolução)</strong> do Pix: o banco de quem recebeu pode bloquear o valor. Faça também um boletim de ocorrência. Quanto mais rápido, maior a chance de recuperar.</p>' }
    ],
    fazer: [
      ['gol-limite', 'Configurar limite noturno e por transação do Pix'],
      ['gol-2fa', 'Ativar verificação em duas etapas no WhatsApp e no e-mail'],
      ['gol-familia', 'Combinar com a família uma palavra-código para pedidos de dinheiro'],
      ['gol-oficial', 'Salvar os telefones oficiais do banco na agenda'],
      ['gol-boleto', 'Criar o hábito de conferir beneficiário e CNPJ antes de pagar']
    ]
  },
  {
    id: 'liberdade',
    titulo: 'Liberdade financeira',
    icone: 'umbrella',
    resumo: 'É quando os seus investimentos pagam o seu custo de vida e trabalhar vira escolha. A conta começa por quanto você gasta, não por quanto ganha.',
    secoes: [
      { titulo: 'O que é', html: '<p>Liberdade financeira não é ficar rico: é ter um patrimônio cujo rendimento cobre os seus gastos, sem consumir o principal. Por isso o caminho tem duas alavancas: <strong>aumentar o quanto você investe</strong> e <strong>manter o custo de vida sob controle</strong>.</p>' },
      { titulo: 'O seu número', html: '<p>Uma referência conhecida é a <strong>regra dos 4%</strong>: retirar por ano 4% do patrimônio, o que dá um número de <strong>25 vezes os gastos anuais</strong>. Ela nasceu de estudos com o mercado americano; use como ponto de partida e ajuste a taxa ao seu conforto. Considere a rentabilidade <strong>acima da inflação</strong> (real), senão a conta engana.</p>', ferramenta: 'liberdade' },
      { titulo: 'Como acelerar', html: `<ul>
          <li>Invista um percentual fixo da renda logo ao receber (no Orçamento, a categoria <em>Liberdade financeira</em>).</li>
          <li>Aumentos de renda vão, em boa parte, para o investimento, não para o padrão de vida.</li>
          <li>Diversifique e pense no longo prazo; taxas altas de administração corroem o resultado.</li>
          <li>Invista em você: conhecimento tende a aumentar a renda, e isso acelera tudo.</li>
        </ul>` }
    ],
    fazer: [
      ['lib-gasto', 'Saber quanto custa o meu mês'],
      ['lib-numero', 'Calcular o meu número da liberdade'],
      ['lib-percentual', 'Definir um percentual fixo da renda para investir'],
      ['lib-aumento', 'Combinar comigo: parte de todo aumento vai para o investimento']
    ]
  }
];
