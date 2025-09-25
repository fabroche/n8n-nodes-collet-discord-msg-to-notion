import {
	ApplicationError,
	IDataObject,
	IExecuteFunctions, INode,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';

import {
	APIMessage,
	APIUser,
	APIChannel,
	APIAttachment,
	RESTPostAPIChannelMessageJSONBody,
	APIEmoji,
	MessageType
} from 'discord-api-types/v10';


export class collectDiscordMsgToNotion implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Collect Discord Msg To Notion',
		name: 'collectDiscordMsgToNotion',
		icon: 'file:batata-icon.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Recibe un arreglo de mensajes de Discord y crea un nuevo registro en la base de datos indicada de Notion',
		defaults: {
			name: 'Collect Discord Msg To Notion',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'collectDiscordMsgToNotionApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Direccion De Email',
				name: 'filter',
				type: 'string',
				placeholder: 'incidencia:,incidencias:,',
				default: '',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: Array<{ json: IDataObject }> = [];

		const totalExecutionsinput = this.getInputData().length;

		for (let i = 0; i < items.length; i++) {
			const filterParameter = this.getNodeParameter('filter', i) as string;
			const filtersList = filterParameter.split(',');

			const filteredItems = FilterDiscordMsg(items,filtersList);

			const credentials = await this.getCredentials('verificarEmailApi');
			const apiKey = credentials?.apiKey;

			const response = await this.helpers.httpRequest({
				method: 'GET',
				url: 'https://api.emailable.com/v1/verify',
				qs: {
					email,
					api_key: apiKey,
				},
				headers: {
					Accept: 'application/json',
				},
				json: true,
			});

			const result = Array.isArray(response) ? response : [response];

			result.forEach((item) => {
				returnData.push({
					json: {
						email: item.email,
						score: item.score,
					},
				});
			});
		}

		function FilterDiscordMsg(inputData: INodeExecutionData[], filtersList: string[]) {

			let messages: APIMessage[];

			if (Array.isArray(inputData[totalExecutionsinput - 1].json)) {
				messages = inputData[totalExecutionsinput - 1].json as unknown as APIMessage[];
			} else if (
				inputData[totalExecutionsinput - 1].json &&
				Array.isArray(inputData[totalExecutionsinput - 1].json.messages)
			) {
				messages = inputData[totalExecutionsinput - 1].json.messages as unknown as APIMessage[];
			} else if (Array.isArray(inputData)) {
				// Si cada mensaje es un item separado en n8n
				messages = inputData.map((item) => item.json as unknown as APIMessage);
			} else {
				throw new ApplicationError('No se pudo encontrar un array de mensajes en la entrada');
			}

			// Función para extraer información básica del mensaje
			function extractMessageInfo(message:APIMessage) {
				return {
					id: message.id,
					content: message.content,
					timestamp: message.timestamp,
					author: {
						id: message.author.id,
						username: message.author.username,
						global_name: message.author.global_name,
					},
					channel_id: message.channel_id,
					message_type: message.type,
					reactions: message.reactions || [],
					attachments:
						message.attachments?.map((attachment) => ({
							id: attachment.id,
							filename: attachment.filename,
							size: attachment.size,
							content_type: attachment.content_type,
							url: attachment.url,
						})) || [],
				};
			}

			// Filtrar mensajes que contengan las palabras en los filtros
			if (!messages) {
			return;
			}
				const filteredMessages = messages
					.filter((message: APIMessage) => {
						const content = message.content?.toLowerCase() || '';
						return filtersList.some((filter) => content.includes(filter));
					})
					.map((message: APIMessage) => extractMessageInfo(message));


			// Preparar salida para n8n
			const output = filteredMessages.map((message) => ({
				json: message,
			}));

			// Si no se encontraron mensajes con "incidencias", devolver array vacío
			if (output.length === 0) {
				return [
					{
						json: {
							message: "No se encontraron mensajes que contengan la palabra 'incidencias'",
							total_messages_processed: messages.length,
							filtered_messages_count: 0,
						},
					},
				];
			}

			return output;
		}

		return this.prepareOutputData(returnData);
	}
}
