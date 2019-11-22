import {
    ApolloServerPlugin,
    GraphQLRequestContext,
    GraphQLRequestListener,
    GraphQLServiceContext,
} from 'apollo-server-plugin-base';
import gql from 'graphql-tag';
import path from 'path';

import { createTestEnvironment } from '../../testing/lib/create-test-environment';

import { dataDir, TEST_SETUP_TIMEOUT_MS, testConfig } from './config/test-config';
import { initialData } from './fixtures/e2e-initial-data';

class MyApolloServerPlugin implements ApolloServerPlugin {
    static serverWillStartFn = jest.fn();
    static requestDidStartFn = jest.fn();
    static willSendResponseFn = jest.fn();

    static reset() {
        this.serverWillStartFn = jest.fn();
        this.requestDidStartFn = jest.fn();
        this.willSendResponseFn = jest.fn();
    }

    serverWillStart(service: GraphQLServiceContext): Promise<void> | void {
        MyApolloServerPlugin.serverWillStartFn(service);
    }

    requestDidStart(): GraphQLRequestListener | void {
        MyApolloServerPlugin.requestDidStartFn();
        return {
            willSendResponse(requestContext: any): Promise<void> | void {
                const data = requestContext.response.data;
                MyApolloServerPlugin.willSendResponseFn(data);
            },
        };
    }
}

describe('custom apolloServerPlugins', () => {
    const { server, adminClient, shopClient } = createTestEnvironment({
        ...testConfig,
        apolloServerPlugins: [new MyApolloServerPlugin()],
    });

    beforeAll(async () => {
        await server.init({
            dataDir,
            initialData,
            productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('calls serverWillStart()', () => {
        expect(MyApolloServerPlugin.serverWillStartFn).toHaveBeenCalled();
    });

    it('runs plugin on shop api query', async () => {
        MyApolloServerPlugin.reset();
        await shopClient.query(gql`
            query Q1 {
                product(id: "T_1") {
                    id
                    name
                }
            }
        `);

        expect(MyApolloServerPlugin.requestDidStartFn).toHaveBeenCalledTimes(1);
        expect(MyApolloServerPlugin.willSendResponseFn).toHaveBeenCalledTimes(1);
        expect(MyApolloServerPlugin.willSendResponseFn.mock.calls[0][0]).toEqual({
            product: {
                id: 'T_1',
                name: 'Laptop',
            },
        });
    });

    it('runs plugin on admin api query', async () => {
        MyApolloServerPlugin.reset();
        await adminClient.query(gql`
            query Q2 {
                product(id: "T_1") {
                    id
                    name
                }
            }
        `);

        expect(MyApolloServerPlugin.requestDidStartFn).toHaveBeenCalledTimes(1);
        expect(MyApolloServerPlugin.willSendResponseFn).toHaveBeenCalledTimes(1);
        expect(MyApolloServerPlugin.willSendResponseFn.mock.calls[0][0]).toEqual({
            product: {
                id: 'T_1',
                name: 'Laptop',
            },
        });
    });
});