import {
	ApplicationError,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';

import { Client } from '@notionhq/client';

import { APIMessage, APIAttachment } from 'discord-api-types/v10';

export class CollectDiscordMsgToNotion implements INodeType {
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
				displayName: 'Filtros',
				name: 'filter',
				type: 'string',
				placeholder: 'incidencia:,incidencias:,',
				default: '',
			},
			{
				displayName: 'Data Source ID',
				name: 'dataScourceId',
				type: 'string',
				placeholder: 'b55c9c91-384d-452b-81db-d1ef79372b75',
				default: '',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: Array<{ json: IDataObject }> = [];
		const credentias = await this.getCredentials('collectDiscordMsgToNotionApi');
		const notionClient = new Client({ auth: String(credentias?.apiKey) });

		const totalExecutionsinput = this.getInputData().length;

		for (let i = 0; i < items.length; i++) {
			const dataScourceId = this.getNodeParameter('dataScourceId', i) as string;
			const filterParameter = this.getNodeParameter('filter', i) as string;
			const filtersList = filterParameter.split(',');

			// Nodo de codigo FilteredIssuesFromDiscordForo implemented
			const filteredItems = FilterDiscordMsg(items, filtersList);

			// Implementar una Funcion que obtenga todos los registros en la base de datos de Notion
			const existingIncidenciasNotionData = await fetchNotionExistingIncidenciasData(
				dataScourceId,
				notionClient,
			);

			// const credentials = await this.getCredentials('verificarEmailApi');
			// const apiKey = credentials?.apiKey;
			//
			// const response = await this.helpers.httpRequest({
			// 	method: 'GET',
			// 	url: 'https://api.emailable.com/v1/verify',
			// 	qs: {
			// 		email,
			// 		api_key: apiKey,
			// 	},
			// 	headers: {
			// 		Accept: 'application/json',
			// 	},
			// 	json: true,
			// });

			// const result = Array.isArray(filteredItems) ? filteredItems : [filteredItems];

			const result = [{ filteredItems, existingIncidenciasNotionData }];
			result.forEach((item) => {
				returnData.push({
					json: {
						filteredItems: item.filteredItems,
						existingIncidenciasNotionData: item.existingIncidenciasNotionData,
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
			function extractMessageInfo(message: APIMessage) {
				const attachments: Partial<APIAttachment>[] = mapAttachments(message);

				function mapAttachments(message: APIMessage) {
					return (
						message.attachments?.map((attachment) => ({
							id: attachment.id,
							filename: attachment.filename,
							size: attachment.size,
							content_type: attachment.content_type,
							url: attachment.url,
						})) || []
					);
				}

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
					attachments: attachments,
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
							message: `No se encontraron mensajes que contengan ${filtersList.join(', ')}`,
							total_messages_processed: messages.length,
							filtered_messages_count: 0,
						},
					},
				];
			}

			return output;
		}

		async function fetchNotionExistingIncidenciasData(
			incidenciasDatabaseId: string,
			notionClient: Client,
		) {
			const dataSourceId = incidenciasDatabaseId;
			const response = await notionClient.dataSources.query({
				data_source_id: dataSourceId,
			});
			return response.results;
		}

		return this.prepareOutputData(returnData);
	}
}
