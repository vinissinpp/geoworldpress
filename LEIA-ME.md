# ♟ Tabuleiro: o globo da geopolítica

Site local, no seu PC, com um **globo 3D navegável** que mostra as principais notícias de geopolítica das **últimas 24 horas** no mundo todo. O nome e a ideia vêm do Xadrez Verbal: o mundo como um tabuleiro onde cada país faz o seu lance.

- Passe o mouse num país e um **balão** abre com as notícias dele (até 3), com resumo em português e links para os portais originais.
- Um script coleta manchetes de **39 portais** (PT, EN e ES) e o **Claude** age como editor-chefe: escolhe o que importa, junta as fontes e resume.
- Uma **tarefa do Windows** atualiza tudo **a cada 2 horas**, mesmo com o app do Claude fechado (só precisa do PC ligado).

---

## 1. Uso no dia a dia

| Quero… | Faço… |
|---|---|
| Abrir o globo | Dois cliques em **`abrir-tabuleiro.cmd`**. Ele liga o servidor (se ainda não estiver ligado) e abre `http://localhost:8080` no navegador. |
| Ver quando atualizou | O cabeçalho mostra "atualizado há X min". A página recarrega os dados sozinha a cada 5 minutos. |
| Forçar uma atualização agora | No PowerShell: `Start-ScheduledTask -TaskName "Tabuleiro - atualizar noticias"` |
| Ver o que aconteceu em cada rodada | Abrir `data\state\log.txt` |
| Desligar o servidor | Fechar a janela minimizada "Tabuleiro" na barra de tarefas |

> O servidor só aceita acesso do próprio PC (`127.0.0.1`). Ninguém na rede ou na internet consegue abrir.

---

## 2. O globo

### Navegação
- **Arrastar:** gira o globo. **Scroll:** zoom.
- O globo gira sozinho devagar até você tocar nele.
- **Passar o mouse** num país, capital ou ponto com notícia abre o balão. Dá para levar o mouse até o balão e clicar nos links sem ele fechar.
- **Clicar** num país ou capital com notícia: o globo vira até ele e o balão fica **fixo** (fecha no ✕).
- **‹ ›** no balão: passa entre as notícias daquele país ("1 de 3").
- **♟ Lance do dia:** cada clique leva ao próximo dos 3 a 5 lances mais importantes do mundo (o botão mostra "2/5" etc.).

### O que cada coisa significa
- **Ponto grande pulsando:** país que tem um *lance do dia*.
- **Ponto pequeno:** país com notícia.
- **País "aquecido":** o país fica pintado na cor da categoria da sua notícia principal, e quanto maior a relevância, mais forte a cor.
- **Capitais coloridas e maiores:** capitais de países com notícia (no estilo Capitais).
- **●●●●○:** relevância de 1 a 5.

### Categorias (cores)
| Categoria | Cor | O que entra |
|---|---|---|
| Eleição | 🔵 azul | eleições, campanhas, resultados, posses |
| Votação | 🟣 roxo | parlamentos, cortes supremas, referendos, leis importantes |
| Protesto | 🟠 laranja | protestos, greves gerais, movimentos de rua |
| Conflito | 🔴 vermelho | guerras, ataques, operações militares, terrorismo |
| Diplomacia | 🟢 verde | cúpulas, acordos, sanções, tarifas, organismos internacionais |
| Crise | 🟡 amarelo | crises institucionais, golpes, impeachment, prisão de opositores |

### Estilos (botões no canto superior direito)
- **🏛 Capitais** (padrão): globo noturno com as 199 capitais escritas, inspirado no exemplo *World Cities* do globe.gl.
- **🌎 Satélite:** foto realista com relevo.
- **🌃 Noite:** luzes das cidades.
- **🛰 Tático:** escuro com fronteiras neon, estilo "sala de guerra".

---

## 3. Como funciona por dentro

```
 A cada 2 horas (Tarefa do Windows)
          │
          ▼
 atualizar-oculto.vbs ── roda sem abrir janela
          │
          ▼
 atualizar.js
   1. Tira do globo as notícias com mais de 24h
   2. Lê os 39 RSS (rss.js) ──► só manchetes NOVAS e das últimas 24h
   3. Nada novo?  ──► para aqui, custo zero
   4. Manda para o Claude: regras (prompt.md) + notícias atuais + manchetes novas
   5. Claude devolve: adicionar / reforçar / remover / lances do dia
   6. O script valida tudo e aplica as regras (máx. 3 por país etc.)
   7. Grava data/news.json (de forma segura, nunca pela metade)
          │
          ▼
 index.html (o globo) lê data/news.json
```

### O que é o RSS
Quase todo portal publica um "feed" com as últimas manchetes (título, link, horário e um resumo curto), feito para programas lerem. O script lê esses feeds de graça, sem IA. O Claude só entra para **decidir e escrever**, e é isso que mantém o consumo baixo.

### Proteções que o script garante (não dependem do Claude)
- **Links sempre reais:** o Claude só cita códigos das manchetes (`h12`). O script troca pelo link verdadeiro do RSS, então o Claude nunca escreve uma URL.
- **No máximo 3 notícias por país:** se passar, ficam as mais relevantes e, no empate, as mais recentes.
- **Uma fonte por portal** em cada notícia, até 6 fontes.
- **Validação:** notícias com país desconhecido, categoria inválida ou sem fonte são descartadas.
- **Lances do dia:** se o Claude indicar menos de 3, o script completa com as mais relevantes.
- **Manchete só é "vista" se o Claude processou:** se uma rodada falhar, as mesmas manchetes são tentadas na hora seguinte.
- **Trava:** se uma atualização já estiver rodando (ex.: tarefa + execução manual), a segunda é pulada e anotada no log.
- **Escrita segura:** grava num arquivo temporário e troca no fim, para o globo nunca ler um arquivo quebrado.

---

## 4. Estrutura de arquivos

```
tabuleiro\
├── abrir-tabuleiro.cmd        ← dois cliques para abrir o site
├── index.html                 ← o globo (tudo num arquivo só)
├── LEIA-ME.md                 ← este arquivo
├── data\
│   ├── news.json              ← as notícias atuais (gerado a cada hora)
│   ├── paises.geojson         ← contornos dos 177 países, com código ISO
│   ├── capitais.json          ← 199 capitais com posição e população
│   └── state\                 ← interno (o site não expõe esta pasta)
│       ├── log.txt            ← histórico de cada rodada, com custo
│       ├── seen.json          ← links já processados (esquecidos após 48h)
│       └── rodando.lock       ← só existe enquanto uma atualização roda
└── scripts\
    ├── atualizar.js           ← o coração: coleta, chama o Claude, aplica
    ├── rss.js                 ← leitor de RSS/Atom (sem dependências)
    ├── feeds.json             ← lista dos 39 portais
    ├── prompt.md              ← as regras do "editor-chefe" Claude
    ├── servidor.js            ← servidor local na porta 8080
    └── atualizar-oculto.vbs   ← usado pela tarefa do Windows
```

Nada precisa de `npm install`: só o Node.js (já instalado) e o Claude Code.

---

## 5. Fontes (39 portais)

| Região | Portais |
|---|---|
| Global | BBC, Guardian, Al Jazeera, NYT, NPR, DW, France 24 |
| África | BBC Africa, **AllAfrica** (junta centenas de jornais africanos), Africanews, The Africa Report |
| Oriente Médio | BBC Middle East, Middle East Eye, Al-Monitor |
| Ásia | BBC Asia, South China Morning Post, The Diplomat, Nikkei Asia, CNA (Singapura) |
| Europa | Kyiv Independent, Meduza, Politico Europe, Euronews |
| Oceania | ABC Australia, RNZ Pacific |
| América Latina | BBC Latin America, BBC Mundo 🇪🇸, El País 🇪🇸, Infobae 🇪🇸, MercoPress, France 24 ES 🇪🇸 |
| Brasil | G1 Mundo, G1 Política, Folha, BBC Brasil, Estadão, DW Brasil, RFI Brasil, CNN Brasil |

Observações:
- A **CNN internacional** ficou de fora porque o RSS dela parou de ser atualizado. A **CNN Brasil** entrou no lugar.
- Os portais em espanhol foram incluídos para ter cobertura real de Venezuela, Bolívia, América Central etc. O resumo sai sempre em português.
- Se um feed falhar, o log mostra "Feeds com erro: …" e os outros seguem normalmente.

---

## 6. As regras do editor (Claude)

Ficam em `scripts\prompt.md`. Resumo:

1. **Só geopolítica** (as 6 categorias). Fica de fora: crime comum, acidentes (a não ser com consequência política), esportes, celebridades, mercado, opinião.
2. **Até 3 notícias por país, sem enchimento.** Se só houve uma coisa importante, é uma notícia só.
3. **Cobertura mundial:** valorizar países fora do eixo EUA/Europa quando relevante.
4. **Sem duplicatas:** a mesma notícia de vários portais vira uma só, com várias fontes.
5. **Substituição:** se o país já tem 3 notícias e chegou algo maior, a mais fraca sai.
6. **Relevância de 1 a 5:** 5 muda o tabuleiro mundial; 1 é um sinal fraco que vale acompanhar.
7. **Texto próprio em PT-BR:** título até 90 caracteres e resumo de 1 a 2 frases, em tom neutro e sem inventar fatos.
8. **3 a 5 lances do dia** entre todas as notícias.

O texto das matérias nunca é copiado: só título e resumo próprio, mais o link para o portal.

---

## 7. Atualização automática

- **Tarefa do Windows:** `Tabuleiro - atualizar noticias`, **a cada 2 horas**, nas horas pares (16:00, 18:00, 20:00…).
- Se o PC estava desligado, ela roda assim que ele ligar (`StartWhenAvailable`).
- Cada rodada pode durar no máximo 30 minutos.
- **Não precisa do app do Claude aberto.** Ela usa o Claude Code de terminal, logado com a sua conta.

### Comandos úteis (PowerShell)
```powershell
# Rodar agora
Start-ScheduledTask -TaskName "Tabuleiro - atualizar noticias"

# Pausar / retomar
Disable-ScheduledTask -TaskName "Tabuleiro - atualizar noticias"
Enable-ScheduledTask  -TaskName "Tabuleiro - atualizar noticias"

# Ver próxima execução e resultado da última
Get-ScheduledTask -TaskName "Tabuleiro - atualizar noticias" | Get-ScheduledTaskInfo

# Mudar a frequência (ex.: voltar para 1 hora; troque o -Hours)
$t = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1)
Set-ScheduledTask -TaskName "Tabuleiro - atualizar noticias" -Trigger $t

# Apagar a tarefa
Unregister-ScheduledTask -TaskName "Tabuleiro - atualizar noticias" -Confirm:$false
```

Também dá para gerenciar pelo **Agendador de Tarefas** do Windows (tecla Windows → "Agendador de Tarefas").

### O log (`data\state\log.txt`)
```
[29/10/2026, 15:00:42] 912 manchetes novas · 0 notícias expiraram
[29/10/2026, 15:12:34] OK · +57 notícias · 53 no globo em 32 países · custo ≈ US$ 1.247
```
Mostra quantas manchetes chegaram, quantas notícias entraram, o total no globo e o **custo estimado** da rodada.

---

## 8. Consumo

- A rodada usa o modelo **Haiku 5.5** (o mais econômico) e é **abatida da cota do seu plano Pro**, não cobrada à parte: o Claude de terminal está logado com a assinatura, sem chave de API. O "US$" do log é só o valor equivalente pela API, para você ter noção do tamanho do consumo.
- **O cuidado é a cota:** o Pro tem limite de uso por janela de horas e por semana, dividido com o seu uso normal do Claude. Se acabar, as rodadas falham com erro de limite (aparece no log) até a cota renovar.
- Só haveria cobrança se o *uso extra* (extra usage) estivesse ligado na conta (claude.ai → Configurações → Uso / Cobrança).
- **A primeira rodada é a mais pesada** (≈ US$ 1,25 com Sonnet, cerca de 12 min; foi antes da troca para Haiku), porque processa as 24h inteiras de manchetes (~900).
- **As rodadas a cada 2 horas** recebem só as manchetes novas desde a última (normalmente bem menos), então custam bem menos. Hora sem nada novo **não chama o Claude**.
- Em 29/10 a tarefa das 15:00 e uma execução manual rodaram ao mesmo tempo e o custo dobrou. A **trava** criada depois disso impede que se repita.

**Configuração atual: Haiku 5.5 a cada 2 horas** (escolhida em 29/10 para poupar a cota).

**Para ajustar:**
| Ajuste | Onde | Efeito |
|---|---|---|
| Voltar para Sonnet | `atualizar.js`, em `--model claude-haiku-5-5` → `--model claude-sonnet-5-5` | julgamento melhor, gasta bem mais cota |
| Mudar a frequência | comando da seção 7 | mais ou menos rodadas por dia |
| Tirar feeds pouco úteis | `feeds.json` | menos manchetes por rodada |

---

## 9. Formato do `news.json`

```json
{
  "atualizado": "2026-10-29T18:12:34.000Z",
  "seq": 57,
  "lances": ["n6", "n1", "n51", "n4", "n32"],
  "noticias": [
    {
      "id": "n1",
      "a3": "ISR",
      "pais": "Israel",
      "cat": "eleicao",
      "rel": 5,
      "titulo": "Eleição em Israel termina sem maioria clara…",
      "resumo": "Com quase toda a apuração concluída…",
      "fontes": [{ "nome": "BBC", "url": "https://…", "lang": "EN", "publicado": "…" }],
      "lat": 31.78, "lng": 35.21,
      "publicado": "…",
      "atualizado": "…"
    }
  ]
}
```
- `a3`: código ISO do país (alguns seguem o mapa: Palestina = `PSX`, Sudão do Sul = `SDS`, Saara Ocidental = `SAH`, Kosovo = `KOS`; o script converte sozinho).
- `lat`/`lng`: posição da capital (a mais populosa, quando o país tem mais de uma) ou o centro do país.
- `atualizado`: horário da fonte mais recente. É ele que conta para as 24h.

---

## 10. Ajustes comuns

| Quero mudar… | Onde |
|---|---|
| Adicionar ou remover portal | `scripts\feeds.json`: copie uma linha e troque nome, região, idioma e URL |
| As regras do editor | `scripts\prompt.md` (texto em português, é só editar) |
| Máximo de notícias por país | `atualizar.js` → `MAX_POR_PAIS = 3` |
| Janela de 24h | `atualizar.js` → `DIA` (e o texto do cabeçalho em `index.html`) |
| Máximo de fontes por notícia | `atualizar.js` → `MAX_FONTES = 6` |
| Estilo inicial do globo | `index.html` → `let style = 'capitais'` (`realista`, `noturno`, `tatico`) |
| Cores das categorias | `index.html` → `CATS` |
| Porta do site | `servidor.js` (8080) e `abrir-tabuleiro.cmd` |

Depois de mudar `prompt.md` ou `feeds.json`, a próxima rodada já usa a versão nova.

---

## 11. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Globo vazio e "Ainda sem notícias" | nenhuma rodada deu certo ainda | ver `log.txt` |
| Log com erro de limite / "usage limit" | a cota do Pro acabou | espera renovar; se for frequente, rodar a cada 3 h |
| Log com "Not logged in" | o Claude de terminal perdeu o login | no PowerShell: `& "$env:LOCALAPPDATA\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\npm\claude.cmd"` e fazer o login de novo |
| `claude` "não é reconhecido" no PowerShell | ele foi instalado pelo app e não está no PATH | usar o caminho completo acima (o script já faz isso sozinho) |
| "Feeds com erro: X" | o portal mudou o endereço do RSS ou está fora do ar | trocar a URL em `feeds.json` ou remover |
| "Outra atualização já está rodando" | duas rodadas ao mesmo tempo | normal, é a trava agindo. Se aparecer por mais de 40 min seguidos, apague `data\state\rodando.lock` |
| "atualizado há 5 h" (o normal é até 2 h) | PC desligado ou tarefa pausada | conferir a tarefa (seção 7) |
| Página não abre | servidor desligado | rodar `abrir-tabuleiro.cmd` de novo |
| Globo sem textura | sem internet (as imagens do globo vêm de CDN) | conferir a conexão |

---

## 12. Decisões tomadas (e por quê)

- **RSS + Claude em vez de "Claude pesquisando sozinho":** gasta bem menos, é mais previsível e os links são sempre reais.
- **Até 3 notícias por país, janela de 24h:** cobertura do mundo todo sem poluir o globo.
- **Fontes em PT, EN e ES:** a mídia em inglês cobre pouco a América Latina e a África.
- **Lances do dia:** dão hierarquia quando 30 a 50 países estão acesos.
- **Resumo próprio + link:** respeita o direito autoral dos portais e mantém o balão curto.
- **Tudo local e sem dependências:** só Node.js e Claude Code; nada para instalar ou manter.

## 13. Ideias para depois

- **Arcos entre países** quando a notícia envolve dois deles (acordo, sanção, guerra).
- **Linha do tempo:** slider para ver os últimos 7 dias.
- **Calendário de eleições** futuras marcado no globo.
- **Selo de origem da fonte** para comparar como cada região cobre o mesmo fato.
- **Busca no Google Notícias** para países que ficam muitos dias sem aparecer.
- **Abrir no celular** pela rede de casa.
- **Ligar o servidor junto com o Windows** (hoje é pelo `abrir-tabuleiro.cmd`).
