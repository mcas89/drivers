const baseURL = 'https://cardosoborracharia-a8854-default-rtdb.firebaseio.com';
const geoapifyKey = '6d5858a5a2b143618a05523338f5a0aa';
let motoristaCPF = '';
let motoristaCreditos = 0;
let rotaAtual = null;
let cancelamentoPermitido = true;
let mapaCorrida;
let wakeLock = null;
let timestampAceitacao = null;
let podeCancelarComCredito = true;

window.onload = () => {
  solicitarWakeLock()
  document.getElementById('painelMotorista').classList.add('hidden');
const motoristaSalvo = localStorage.getItem('motoristaLogado');
if (motoristaSalvo) {
motoristaCPF = motoristaSalvo;
fetch(`${baseURL}/motoristas/${motoristaCPF}.json`)
  .then(res => res.json())
  .then(data => {
    if (data) {
      motoristaCreditos = data.creditos || 0;
      document.getElementById('nomeMotorista').textContent = data.nome;
      document.getElementById('telefoneMotorista').textContent = data.telefone;
      document.getElementById('modeloMotorista').textContent = data.modelo;
      document.getElementById('placaMotorista').textContent = data.placa;
      document.getElementById('creditosMotorista').textContent = motoristaCreditos;

      document.getElementById('loginContainer').classList.add('hidden');
      document.getElementById('painelMotorista').classList.remove('hidden');
      buscarCorridaAceita();

      carregarCorridas();
      setInterval(carregarCorridas, 5000);
    }
  });
}
}

function logoutMotorista() {
  localStorage.removeItem('motoristaLogado');
  location.reload(); // Atualiza a página e volta pro login
  document.getElementById('cardPainel').classList.remove('hidden');
  document.getElementById('painelMotorista').classList.remove('hidden');
  
}

async function solicitarWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('Tela mantida ativa.');
  } catch (err) {
    console.error('Não foi possível manter a tela ativa:', err);
  }
}

document.addEventListener('visibilitychange', () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    solicitarWakeLock();
  }
});

function buscarCorridaAceita() {
fetch(`${baseURL}/corridas.json`)
.then(res => res.json())
.then(data => {
  if (!data) return;

  for (const id in data) {
    const corrida = data[id];
    if (corrida.motorista === motoristaCPF && corrida.status === 'aceita') {
      rotaAtual = id;

      document.getElementById('endPartida').textContent = corrida.partida;
      document.getElementById('endDestino').textContent = corrida.destino;
      document.getElementById('valorCorrida').textContent = `R$ ${corrida.preco.toFixed(2)}`;
      document.getElementById('distanciaAceita').textContent = corrida.distancia_km.toFixed(2);

      document.getElementById('corridaAceitaCard').classList.remove('hidden');

      mostrarMapa(corrida.partida, corrida.destino);

      // 🔵 Criar o botão de Cancelar (se não existir)
      const card = document.getElementById('corridaAceitaCard');
      let btnCancelar = document.getElementById('btnCancelarTemp');
      if (!btnCancelar) {
        btnCancelar = document.createElement('button');
        btnCancelar.id = 'btnCancelarTemp';
        btnCancelar.style.marginTop = '10px';
        btnCancelar.style.backgroundColor = 'red';
        btnCancelar.style.color = 'white';
        btnCancelar.style.borderRadius = '8px';
        btnCancelar.style.padding = '10px';
        btnCancelar.textContent = 'Cancelar Corrida';
        btnCancelar.onclick = () => cancelarCorrida(id, calcularCreditosPorValor(corrida.preco));
        card.appendChild(btnCancelar);
      }

      // 🕑 Salvar o momento da aceitação
      timestampAceitacao = Date.now();

      // 🔵 Buscar dados do passageiro
      fetch(`${baseURL}/passageiros/${id}.json`)
        .then(res => res.json())
        .then(passageiro => {
          if (passageiro) {
            const infoPassageiro = document.createElement('div');
            infoPassageiro.innerHTML = `
              <p><strong>Passageiro:</strong> ${passageiro.nome}</p>
              <p><strong>Telefone:</strong> ${passageiro.telefone}</p>
            `;
            card.appendChild(infoPassageiro);
          }
        })
        .catch(error => {
          console.error('Erro ao buscar dados do passageiro:', error);
        });

      break; // achou, pode parar
    }
  }
})
.catch(error => {
  console.error('Erro ao buscar corrida aceita:', error);
});
}

function finalizarCancelamento() {
    // Remove a exibição do alerta padrão do navegador
    document.getElementById('corridaAceitaCard').classList.add('hidden');
    rotaAtual = null;
    document.getElementById('corridasContainer').style.display = 'block';
    document.querySelector('h3 i.fa-taxi').parentElement.style.display = 'block';
    carregarCorridas();
  }

function cancelarCorrida(id) {
    if (!id) return;
  
    console.log('Iniciando cancelamento da corrida com id:', id);
  
    // Busca a corrida para saber quantos créditos foram usados
    fetch(`${baseURL}/corridas/${id}.json`)
      .then(res => res.json())
      .then(corrida => {
        if (!corrida) {
          console.log('Corrida não encontrada');
          return;
        }
  
        const creditosUsados = corrida.creditosUsados || 0;
  
        const atualizacoes = {
          [`corridas/${id}/status`]: 'pendente',
          [`corridas/${id}/motorista`]: null
        };
  
        console.log('Créditos usados:', creditosUsados);
  
        if (podeCancelarComCredito) {
          fetch(`${baseURL}/motoristas/${motoristaCPF}/creditos.json`)
            .then(res => res.json())
            .then(creditosAtuais => {
              const novosCreditos = (creditosAtuais || 0) + creditosUsados;
              atualizacoes[`motoristas/${motoristaCPF}/creditos`] = novosCreditos;
  
              console.log('Novos créditos do motorista:', novosCreditos);
  
              fetch(`${baseURL}/.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(atualizacoes)
              }).then(() => {
                motoristaCreditos = novosCreditos;
                document.getElementById('creditosMotorista').textContent = novosCreditos;
                console.log('Chamando finalizarCancelamento');
                finalizarCancelamento('w');  // Chama a função sem a mensagem
                console.log('Chamando mostrarAlertaSimples');
                mostrarAlertaSimples('Corrida cancelada');  // Exibe a mensagem de alerta
                carregarCorridas();
              });
            })
            .catch(error => {
              console.error('Erro ao buscar créditos do motorista:', error);
              alert('Erro ao buscar créditos do motorista.');
            });
        } else {
          fetch(`${baseURL}/.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(atualizacoes)
          }).then(() => {
            console.log('Chamando finalizarCancelamento');
            finalizarCancelamento('s');  // Chama a função sem a mensagem
            console.log('Chamando mostrarAlertaSimples');
            mostrarAlertaSimples('Corrida cancelada');  // Exibe a mensagem de alerta
            carregarCorridas();
          });
        }
      })
      .catch(error => {
        console.error('Erro ao cancelar corrida:', error);
        alert('Erro ao cancelar a corrida. Tente novamente.');
      });
  }
  
function mostrarCadastro() {
  document.getElementById('loginContainer').classList.add('hidden');
  document.getElementById('cadastroContainer').classList.remove('hidden');
}

function mostrarLogin() {
  document.getElementById('cadastroContainer').classList.add('hidden');
  document.getElementById('loginContainer').classList.remove('hidden');
  document.getElementById('painelMotorista').classList.add('hidden');

}

async function cadastrarMotorista() {
const nome = document.getElementById('nomeCadastro').value.trim();
const cpf = document.getElementById('cpfCadastro').value.trim();
const senha = document.getElementById('senhaCadastro').value.trim();
const telefone = document.getElementById('telefoneCadastro').value.trim();
const modelo = document.getElementById('modeloCadastro').value.trim();
const placa = document.getElementById('placaCadastro').value.trim();

// Validação simples
if (!nome || !cpf || !senha || !telefone || !modelo || !placa) {
alert('Por favor, preencha todos os campos.');
return;
}

// Validação de CPF
if (!validarCPF(cpf)) {
alert('CPF inválido. Por favor, digite um CPF válido.');
return;
}

try {
// Verifica se o CPF já está cadastrado
const res = await fetch(`${baseURL}/motoristas/${cpf}.json`);
if (!res.ok) throw new Error('Erro ao verificar CPF.');

const data = await res.json();
if (data) {
  alert('Já existe um motorista cadastrado com este CPF.');
  return;
}

// Cadastra o novo motorista
const response = await fetch(`${baseURL}/motoristas/${cpf}.json`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nome, senha, telefone, modelo, placa, creditos: 0 })
});

if (!response.ok) throw new Error('Erro ao cadastrar motorista');

alert('Cadastro realizado com sucesso!');

// Oculta o painel do motorista e mostra o login após o cadastro
document.getElementById('painelMotorista').classList.add('hidden');
mostrarLogin();  // Chama a função para exibir a tela de login

} catch (error) {
console.error(error);
alert('Erro ao cadastrar. Tente novamente.');
}
}

function sairParaLogin() {
  // Oculta o painel do motorista ao sair do cadastro
  document.getElementById('painelMotorista').classList.add('hidden');
  
  // Chama a função que exibe a tela de login
  mostrarLogin();
}

function loginMotorista() {

  const cpf = document.getElementById('cpf').value;
  const senha = document.getElementById('senha').value;

  fetch(`${baseURL}/motoristas/${cpf}.json`)
    .then(res => res.json())
    .then(data => {
      if (!data || data.senha !== senha) return alert('CPF ou senha incorretos');

      motoristaCPF = cpf;
      motoristaCreditos = data.creditos || 0;

      document.getElementById('nomeMotorista').textContent = data.nome;
      document.getElementById('telefoneMotorista').textContent = data.telefone;
      document.getElementById('modeloMotorista').textContent = data.modelo;
      document.getElementById('placaMotorista').textContent = data.placa;
      document.getElementById('creditosMotorista').textContent = motoristaCreditos;
    

      document.getElementById('loginContainer').classList.add('hidden');
      document.getElementById('painelMotorista').classList.remove('hidden');
      
      

      localStorage.setItem('motoristaLogado', cpf);
      solicitarWakeLock()
      buscarCorridaAceita();



      carregarCorridas();
      setInterval(carregarCorridas, 5000);
    });
}

function calcularCreditosPorValor(preco) {
  if (preco <= 10) return 1;
  if (preco <= 15) return 2;
  if (preco <= 20) return 3;
  if (preco <= 25) return 4;
  if (preco <= 30) return 5;
  if (preco <= 40) return 6;
  if (preco <= 50) return 7;
  return 8;
}

function carregarCorridas() {
fetch(`${baseURL}/corridas.json`)
.then(res => res.json())
.then(data => {
  const container = document.getElementById('corridasContainer');
  container.innerHTML = '';

  for (const id in data) {
    const corrida = data[id];
    if (corrida.status === 'pendente' || corrida.status === 'cancelado') {
      const creditosNecessarios = calcularCreditosPorValor(corrida.preco);

      const card = document.createElement('div');
    card.className = 'card-corrida';
    card.id = `card-${id}`; // cada card com um ID único!

    card.innerHTML = `
    <p><i class="fas fa-map-marker-alt"></i> <strong>Partida:</strong><br>${corrida.partida}</p>
    <p><i class="fas fa-map-pin"></i> <strong>Destino:</strong><br>${corrida.destino}</p>
  
    <div style="display: flex; justify-content: center; gap: 12px; margin: 8px 0; font-size: 13px;">
      <span><i class="fas fa-road"></i> ${corrida.distancia_km.toFixed(2)} km</span>
      <span><i class="fas fa-coins"></i> R$ ${corrida.preco.toFixed(2)}</span>
      <span><i class="fas fa-star"></i> ${creditosNecessarios} créditos</span>
    </div>
  
    <div style="display: flex; gap: 5px; margin-top: 2px;">
      <button style="flex: 1; padding: 5px; font-size: 13px; border-radius: 6px; background-color: #4CAF50; color: white; border: none; font-weight: 600; cursor: pointer;"
        onclick="aceitarCorrida('${id}', ${creditosNecessarios}, '${corrida.partida}', '${corrida.destino}', ${corrida.preco}, ${corrida.distancia_km})">
        <i class="fas fa-check"></i> Aceitar
      </button>
      <button style="flex: 1; padding: 5px; font-size: 13px; border-radius: 6px; background-color: #e53935; color: white; border: none; font-weight: 600; cursor: pointer;"
        onclick="fecharCorrida('${id}')">
        <i class="fas fa-times"></i> Fechar
      </button>
    </div>
  `;
  
  
    container.appendChild(card);
    






    }
  }
});
}

function aceitarCorrida(id, creditosNecessarios, partida, destino, preco, distancia_km) {
if (motoristaCreditos < creditosNecessarios) {
    mostrarAlertaSimples('Créditos insuficientes para aceitar esta corrida.');
    return;
}

fetch(`${baseURL}/corridas/${id}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        status: 'aceita',
        motorista: motoristaCPF,
        preco: preco,
        distancia_km: distancia_km,
        creditosUsados: creditosNecessarios
    })
}).then(() => {
    motoristaCreditos -= creditosNecessarios;
    document.getElementById('creditosMotorista').textContent = motoristaCreditos;

    fetch(`${baseURL}/motoristas/${motoristaCPF}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditos: motoristaCreditos })
    });

    document.getElementById('endPartida').textContent = partida;
    document.getElementById('endDestino').textContent = destino;
    document.getElementById('valorCorrida').textContent = `R$ ${preco.toFixed(2)}`;
    document.getElementById('distanciaAceita').textContent = distancia_km.toFixed(2);

    const card = document.getElementById('corridaAceitaCard');
    
    // Limpar dados antigos do passageiro assim que o card for aberto
    const antigoPassageiro = card.querySelector('.info-passageiro');
    if (antigoPassageiro) {
        antigoPassageiro.remove();
    }

    // Mostrar o card de corrida aceita
    card.classList.remove('hidden');

    // Esconder os ícones de corridas disponíveis
    document.querySelector('h3 i.fa-taxi').parentElement.style.display = 'none';
    document.getElementById('corridasContainer').style.display = 'none';

    // Remover o card antigo da corrida, se houver
    const cardAceito = document.getElementById(`card-${id}`);
    if (cardAceito) {
        cardAceito.remove();
    }

    // Atualizar a variável da rota atual
    rotaAtual = id;
    mostrarMapa(partida, destino);

    // Criação do botão cancelar
    const btnExistente = document.getElementById('btnCancelarTemp');
    if (btnExistente) btnExistente.remove();

    let btnCancelar = document.createElement('button');
    btnCancelar.id = 'btnCancelarTemp';
    btnCancelar.style.marginTop = '10px';
    btnCancelar.style.backgroundColor = 'red';
    btnCancelar.style.color = 'white';
    btnCancelar.style.borderRadius = '8px';
    btnCancelar.style.padding = '10px';
    btnCancelar.textContent = 'Cancelar Corrida (10s)';
    btnCancelar.onclick = () => cancelarCorrida(id);

    card.appendChild(btnCancelar);  // Adiciona o botão de cancelar no card

    // ⏱️ Início do temporizador de cancelamento com crédito
    let segundos = 10;
    podeCancelarComCredito = true;

    const interval = setInterval(() => {
        segundos--;
        btnCancelar.textContent = segundos > 0 ? `Cancelar Corrida (${segundos}s)` : 'Cancelar Corrida';

        if (segundos === 0) {
            clearInterval(interval);
            podeCancelarComCredito = false;

            // Mostrar dados do passageiro
            fetch(`${baseURL}/passageiros/${id}.json`)
                .then(res => res.json())
                .then(passageiro => {
                    if (passageiro) {
                        const infoPassageiro = document.createElement('div');
                        infoPassageiro.classList.add('info-passageiro');
                        infoPassageiro.innerHTML = `
                            <p><strong>Passageiro:</strong> ${passageiro.nome}</p>
                            <p><strong>Telefone:</strong> ${passageiro.telefone}</p>
                        `;
                        card.appendChild(infoPassageiro);
                    }
                })
                .catch(error => {
                    console.error('Erro ao buscar dados do passageiro:', error);
                });
        }
    }, 1000);

    // 👁️ Iniciar monitoramento da corrida
    monitorarCorridaAceita(id, motoristaCPF);

}).catch(error => {
    console.error('Erro ao aceitar a corrida:', error);
    alert('Erro ao aceitar a corrida. Tente novamente.');
});
}

function copiarTexto(id) {
  const texto = document.getElementById(id).textContent;
  navigator.clipboard.writeText(texto);
  mostrarAlertaSimples('copiado');
}

async function mostrarMapa(partida, destino) {
    try {
      const coords = await Promise.all([
        getCoords(partida),
        getCoords(destino)
      ]);
  
      if (!coords[0] || !coords[1]) return;
  
      // Remove mapa anterior
      if (mapaCorrida) {
        mapaCorrida.remove();
      }
  
      mapaCorrida = L.map('mapaCorrida').setView(coords[0], 13);
  
      // Camada visual
      L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${geoapifyKey}`, {
        attribution: '© OpenMapTiles © OpenStreetMap contributors',
        maxZoom: 20
      }).addTo(mapaCorrida);
  
      // Ícones personalizados
      const iconeA = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/252/252025.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });
  
      const iconeB = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });
  
      // Marcadores visíveis mesmo que rota falhe
      L.marker(coords[0], { icon: iconeA }).addTo(mapaCorrida).bindPopup("Partida").openPopup();
      L.marker(coords[1], { icon: iconeB }).addTo(mapaCorrida).bindPopup("Destino");
  
      // ✅ Corrigido: ordem correta [latitude, longitude]
      const rotaURL = `https://api.geoapify.com/v1/routing?waypoints=${coords[0][0]},${coords[0][1]}|${coords[1][0]},${coords[1][1]}&mode=drive&apiKey=${geoapifyKey}`;
      const routeRes = await fetch(rotaURL);
      const routeData = await routeRes.json();
  
      if (routeData.features && routeData.features.length > 0) {
        const rotaCoords = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        L.polyline(rotaCoords, { color: 'blue', weight: 5 }).addTo(mapaCorrida);
        mapaCorrida.fitBounds(rotaCoords, { padding: [50, 50] });
  
        document.getElementById('distanciaAceita').textContent = (routeData.features[0].properties.distance / 1000).toFixed(2);
        document.getElementById('duracaoAceita').textContent = (routeData.features[0].properties.time / 60).toFixed(1);
      } else {
        console.warn('Rota não encontrada, mas marcadores exibidos.');
      }
    } catch (error) {
      console.error('Erro ao mostrar o mapa:', error);
    }
  }
  
async function getCoords(endereco) {
  const res = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(endereco)}&apiKey=${geoapifyKey}`);
  const data = await res.json();
  if (!data.features || data.features.length === 0) {
    alert('Endereço não encontrado: ' + endereco);
    return null;
  }
  return [data.features[0].geometry.coordinates[1], data.features[0].geometry.coordinates[0]];
}

async function mostrarMapa(partida, destino) {
  const coords = await Promise.all([
    getCoords(partida),
    getCoords(destino)
  ]);

  if (!coords[0] || !coords[1]) return;

  if (mapaCorrida) {
    mapaCorrida.remove();
  }
  mapaCorrida = L.map('mapaCorrida').setView(coords[0], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapaCorrida);
  L.marker(coords[0]).addTo(mapaCorrida).bindPopup("Partida").openPopup();
  L.marker(coords[1]).addTo(mapaCorrida).bindPopup("Destino");

  fetch(`https://api.geoapify.com/v1/routing?waypoints=${coords[0][1]},${coords[0][0]}|${coords[1][1]},${coords[1][0]}&mode=drive&apiKey=${geoapifyKey}`)
    .then(res => res.json())
    .then(data => {
      if (!data.features || data.features.length === 0);

      const rota = data.features[0];
      const rotaCoords = rota.geometry.coordinates.map(c => [c[1], c[0]]);
      L.polyline(rotaCoords, { color: 'blue' }).addTo(mapaCorrida);
      mapaCorrida.fitBounds(rotaCoords);

      document.getElementById('distanciaAceita').textContent = (rota.properties.distance / 1000).toFixed(2);
      document.getElementById('duracaoAceita').textContent = (rota.properties.time / 60).toFixed(1);
    })
    .catch();
}

function fecharCorrida(id) {
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.remove();
  }
}

function monitorarCorridaAceita(idCorrida, cpfMotorista) {
const interval = setInterval(() => {
fetch(`${baseURL}/corridas/${idCorrida}.json`)
  .then(res => res.json())
  .then(corrida => {
    // Se a corrida sumiu completamente (deletada do banco)
    if (!corrida) {
      clearInterval(interval);
    //  alert('Corrida foi removida do sistema.');
      document.getElementById('corridaAceitaCard').classList.add('hidden');
      document.querySelector('h3 i.fa-taxi').parentElement.style.display = 'block';
      carregarCorridas();
      return;
    }

    // Se a corrida foi cancelada por outro (não é mais "aceita")
    if (corrida.status !== 'aceita' || corrida.motorista !== cpfMotorista) {
      clearInterval(interval);
      //alert('Corrida não está mais disponível.');
      document.getElementById('corridaAceitaCard').classList.add('hidden');
      document.querySelector('h3 i.fa-taxi').parentElement.style.display = 'block';
      carregarCorridas();
      return;
    }
  })
  .catch(error => {
    console.error('Erro ao monitorar corrida:', error);
    clearInterval(interval);
  });
}, 3000);
}

function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g, ''); // Remove não números

  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false; // Ex: 111.111.111-11

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) return false;

  return true;
}

function mostrarAlertaSimples(mensagem) {
// Evita criar vários alertas empilhados
if (document.getElementById('alerta-simples')) return;

const alerta = document.createElement('div');
alerta.id = 'alerta-simples';
alerta.style.position = 'fixed';
alerta.style.top = '20px';
alerta.style.left = '50%';
alerta.style.transform = 'translateX(-50%)';
alerta.style.backgroundColor = '#ff4d4d'; // vermelho mais bonito
alerta.style.color = '#fff';
alerta.style.padding = '12px 20px';
alerta.style.borderRadius = '8px';
alerta.style.textAlign = 'center';
alerta.style.zIndex = '1000';
alerta.style.fontSize = '16px';
alerta.style.fontFamily = 'Arial, sans-serif';
alerta.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
alerta.style.opacity = '0';
alerta.style.transition = 'opacity 0.5s ease';

alerta.innerText = mensagem;
document.body.appendChild(alerta);

// Deixa o alerta visível com transição
setTimeout(() => {
    alerta.style.opacity = '1';
}, 50);

// Some depois de 4 segundos
setTimeout(() => {
    alerta.style.opacity = '0';
    setTimeout(() => {
        alerta.remove();
    }, 500); // Espera a transição terminar antes de remover
}, 4000);
}

function editarDadosMotorista() {
fetch(`${baseURL}/motoristas/${motoristaCPF}.json`)
.then(res => res.json())
.then(data => {
  if (data) {
    document.getElementById('editarNome').value = data.nome || '';
    document.getElementById('editarTelefone').value = data.telefone || '';
    document.getElementById('editarModelo').value = data.modelo || '';
    document.getElementById('editarPlaca').value = data.placa || '';

    document.getElementById('editarModal').classList.remove('hidden');
  }
});
}

function fecharModal() {
document.getElementById('editarModal').classList.add('hidden');
}

function salvarEdicao() {
const novoNome = document.getElementById('editarNome').value.trim();
const novoTel = document.getElementById('editarTelefone').value.trim();
const novoModelo = document.getElementById('editarModelo').value.trim();
const novaPlaca = document.getElementById('editarPlaca').value.trim();

const atualizados = {
nome: novoNome,
telefone: novoTel,
modelo: novoModelo,
placa: novaPlaca
};

fetch(`${baseURL}/motoristas/${motoristaCPF}.json`, {
method: 'PATCH',
body: JSON.stringify(atualizados)
})
.then(res => res.json())
.then(() => {
// Atualiza na interface
document.getElementById('nomeMotorista').textContent = novoNome;
document.getElementById('telefoneMotorista').textContent = novoTel;
document.getElementById('modeloMotorista').textContent = novoModelo;
document.getElementById('placaMotorista').textContent = novaPlaca;

fecharModal();
mostrarAlertaSimples('Dados atualizados com sucesso!');
})
.catch(err => {
console.error("Erro ao salvar edição:", err);
alert("Erro ao salvar os dados.");
});
}

function obterLocalizacaoAtual(callback) {
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
        const localizacaoAtual = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        callback(localizacaoAtual); // Retorna a localização atual para a função de callback
    }, function() {
        alert("Não foi possível obter sua localização.");
    });
} else {
    alert("Geolocalização não é suportada pelo seu navegador.");
}
}

function navegarPassageiro() {
obterLocalizacaoAtual(function(localizacaoAtual) {
    const partida = document.getElementById('endPartida').textContent; // Endereço de partida do passageiro
    if (partida) {
        const enderecoPartida = encodeURIComponent(partida); // Codifica o endereço para a URL
        // Cria a URL do Google Maps com a localização atual e o endereço de partida
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${localizacaoAtual.lat},${localizacaoAtual.lng}&destination=${enderecoPartida}`;
        window.open(googleMapsUrl, '_blank'); // Abre o Google Maps em uma nova aba
    } else {
        alert('Endereço de partida não encontrado!');
    }
});
}

function navegarDestino() {
obterLocalizacaoAtual(function(localizacaoAtual) {
    const destino = document.getElementById('endDestino').textContent; // Endereço de destino do passageiro
    if (destino) {
        const enderecoDestino = encodeURIComponent(destino); // Codifica o endereço para a URL
        // Cria a URL do Google Maps com a localização atual e o endereço de destino
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${localizacaoAtual.lat},${localizacaoAtual.lng}&destination=${enderecoDestino}`;
        window.open(googleMapsUrl, '_blank'); // Abre o Google Maps em uma nova aba
    } else {
        alert('Endereço de destino não encontrado!');
    }
});
}

