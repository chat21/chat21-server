import * as http from 'http';
import * as https from 'https';
import * as url from 'url';

export class WebhookSender {
    httpAgent: any;
    httpsAgent: any;
    logger: any;

    constructor(logger: any) {
        this.logger = logger;
        this.httpAgent = new http.Agent({ keepAlive: true });
        this.httpsAgent = new https.Agent({ keepAlive: true });
    }

    sendData(endpoint: string, json: any, callback?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            var q = url.parse(endpoint, true);
            var protocol: any = (q.protocol == "http:") ? http : https;
            let agent = (q.protocol == "http:") ? this.httpAgent : this.httpsAgent;
            let options = {
                path: q.pathname,
                host: q.hostname,
                port: q.port,
                method: 'POST',
                headers: {
                    "Content-Type": "application/json"
                },
                agent: agent
            };

            try {
                const req = protocol.request(options, (response: any) => {
                    this.logger.debug("statusCode: " + response.statusCode + " for webhook_endpoint: " + endpoint);
                    if (response.statusCode < 200 || response.statusCode > 299) {
                        this.logger.debug("http statusCode error " + response.statusCode + " for webhook_endpoint: " + endpoint);
                        const err = { statusCode: response.statusCode };
                        if (callback) callback(err, null);
                        return reject(err);
                    }
                    var respdata = '';
                    response.on('data', (chunk: any) => {
                        respdata += chunk;
                    });
                    response.on('end', () => {
                        this.logger.debug("WEBHOOK RESPONSE: " + respdata + " for webhook_endpoint: " + endpoint);
                        if (callback) callback(null, respdata);
                        return resolve(respdata);
                    });
                });
                req.on('error', (err: any) => {
                    this.logger.error("WEBHOOK RESPONSE Error: ", err);
                    if (callback) callback(err, null);
                    return reject(err);
                });
                req.write(JSON.stringify(json));
                req.end();
            } catch (err) {
                this.logger.error("An error occurred while posting this json " + JSON.stringify(json), err);
                if (callback) callback(err, null);
                return reject(err);
            }
        });
    }
}
