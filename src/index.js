import fetch from 'node-fetch';
import chalk from 'chalk';

const { log } = console;
const logEnter = (text) => {
	log(text);
	log();
};

const iconByStatus = {
	'A Caminho': '🚚',
	'Em transferência': '🚚',
	'Envio em rua': '🙌',
	'Em processo de entrega': '🙌',
	'Entregue': '🎁',
	'Entrega realizada normalmente': '🎁',
	'Endereço insuficiente': '⚠️',
	'Destinatário ausente': '⚠️',
	'Ausente': '⚠️',
	'Pedido Recebido': '🛬',
	'Envio encaminhado': '🛬',
	'Recepção na transportadora': '📦',
	'Recepcionado': '📦',
	DEFAULT: '🚧',
};

function getIcon(status) {
	return iconByStatus[status] || iconByStatus.DEFAULT;
}

async function getHash() {
	const url = 'https://sequoialog.com.br/rastreio/';

	const response = await fetch(url);

	if ( response.status != '200' ) {
		log("❌ Retorno inesperado:", response.status);
		return null;
	}

	const body = await response.text()
	const hash = body.split('/external/redirect/').pop().split("'")[0];
	return hash;
}

async function getCookie(hash) {
	const url = 'https://portalvesta-api.sequoialog.com.br/.auth/cookieExternal';
	const options = { method: 'POST', body: JSON.stringify({ hash }), headers: { 'Content-Type': 'application/json'}};

	const response = await fetch(url, options);

	if ( ! response.ok ) {
		log("❌ Retorno inesperado:", response.status);
		return null;
	}

	const raw = await response.headers.raw()['set-cookie'];

	return raw.map((entry) => entry.split(';')[0]).join(';');
}

async function getOrders(code, cookie) {
	let orders = await getOrdersByTracker(code, cookie);
	if ( orders.length === 0 ) {
		orders = await getOrdersByCpf(code, cookie)
	}

	return orders;
}

async function getOrdersByTracker(code, cookie) {
	const url = `https://portalvesta-api.sequoialog.com.br/ConsultaDetalhes/SelecionarRastreamentoPedidos?codRastreioNumPedido=${code}`;
	const options = { headers: { cookie } };

	const response = await fetch(url, options);
	
	if ( ! response.ok ) {
		log("❌ Retorno inesperado:", response.status);
		return null;
	}

	const orders = await response.json();
	
	return orders;
}

async function getOrdersByCpf(code, cookie) {
	const url = `https://portalvesta-api.sequoialog.com.br/ConsultaDetalhes/SelecionarRastreamentoPedidos?cpf=${code}&itensPorPagina=2500`;
	const options = { headers: { cookie } };

	const response = await fetch(url, options);
	
	if ( ! response.ok ) {
		log("❌ Retorno inesperado:", response.status);
		return null;
	}

	const orders = await response.json();
	
	return orders;
}

async function getEvents(order, cookie) {
	const url = `https://portalvesta-api.sequoialog.com.br/ConsultaDetalhes/SelecionarRastreamentoPedidoHistorico/${order}`;
	const options = { headers: { cookie } };

	const response = await fetch(url, options);
	
	if ( ! response.ok ) {
		log("❌ Retorno inesperado:", response.status);
		return null;
	}

	const events = await response.json();
	
	return events;
}

export default async function run() {
	const code = process?.argv[2]?.toUpperCase();

	if (!code) {
		log(`🖊️Informe o código de rastreio ou CPF/CNPJ para que a consulta seja realizada!`);
		return null;
	}

	logEnter(chalk.bold(`📮 ${code}`));

	const hash = await getHash();
	const cookie = await getCookie(hash);
	const orders = await getOrders(code, cookie);

	if ( orders.length === 0 ) {
		logEnter(chalk.bold('Não foram encontrados registros para este código!'))
	}

	orders?.reverse().forEach(async order => {
		const events = await getEvents(order.pedidoID, cookie);

		log(`Remessa: ${order.documento}`)
		log(`Data: ${new Date(order.data).toLocaleDateString()}`)
		log(`Loja de Compra: ${order.nomeCliente}`)
		log(`Situação: ${order.situacao}`)
		log();
			
		events?.reverse().forEach((event) => {
			log(`==> ${getIcon(event.situacao)} ${event.situacao}`);
			log(chalk.blackBright(`Data e hora: ${new Date(event.data).toLocaleString()}`));
			if( event.localidade ) {
				log(chalk.blackBright(`Localidade: ${event.localidade}`));
			}
			log();
		});
	});

	return null;
}
