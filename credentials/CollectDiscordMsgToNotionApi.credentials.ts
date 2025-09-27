import {
	IAuthenticateGeneric,
	Icon,
	ICredentialType,
	INodeProperties } from 'n8n-workflow';

export class CollectDiscordMsgToNotionApi implements ICredentialType {
	name = 'collectDiscordMsgToNotionApi';
	displayName = 'Collect Discord Msg To Notion API';
	icon: Icon = 'file:batata-icon.svg';

	documentationUrl =
		'https://docs.n8n.io/integrations/creating-nodes/build/declarative-style-node/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			typeOptions: {
				password: true,
			},
			type: 'string',
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				'api_key': '={{$credentials.apiKey}}',
			},
		},
	};

}
