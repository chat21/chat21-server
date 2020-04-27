#!/usr/bin/env node
/*
 * Copyright 2015 Red Hat Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var rhea = require('rhea');

var connection = rhea.connect({ port:5672, host: 'localhost', container_id:'myclient' });
connection.on('receiver_open', function (context) {
    console.log('subscribed');
});

connection.on('sender_open', function (context) {
    console.log('sender');
    //console.log(context);
});
//var sender = connection.open_sender('amq.topic');

connection.on('message', function (context) {
    if (context.message.body === 'detach') {
        // detaching leaves the subscription active, so messages sent
        // while detached are kept until we attach again
        context.receiver.detach();
        context.connection.close();
    } else if (context.message.body === 'close') {
        // closing cancels the subscription
        context.receiver.close();
        context.connection.close();
    } else {
        var mioctx = context; 
        //console.log(context)//
        try{
            
            var topic_parts = [];
            var test = context.message.to.split(".")
           
            
            console.log(test.length)
            if(test.length>10){
                //console.log(context)
                console.log(context.message.application_properties._AMQ_ORIG_ADDRESS);
                topic_parts = context.message.application_properties._AMQ_ORIG_ADDRESS.split(".");
                
            }else{ topic_parts = context.message.to.split(".");
            }
            const sender_id = topic_parts[3]
            const recipient_id = topic_parts[5]
            var dest_topic = 'apps.tilechat.users.' + recipient_id + '.conversations.' + sender_id;
            
            var sender = connection.open_sender(dest_topic);
            sender.on('sendable', function(context1) {
                console.log("spedisco");
                console.log(mioctx.message.body.content.toString(),dest_topic );    
                sender.send({to:dest_topic,body:mioctx.message.body.content});
            //send_message({to:dest_topic,body:context.message.body.content})    
            
            });
            mioctx.delivery.accept();  
            
        }
        catch(err){
            mioctx.delivery.release({delivery_failed:true, undeliverable_here:false});
        }
        //send_message(dest_topic,context.message.body.content.toString());
        
    }
});
// the identity of the subscriber is the combination of container id
// and link (i.e. receiver) name
connection.open_receiver({name:'amq.topic', source:{address:'apps.tilechat.users.*.messages.*', durable:2, expiry_policy:'never'}, autoaccept:false});
//connection.open_receiver({name:'amq.topic1', source:{address:'$sys.mqtt.retain.apps.tilechat.users.*.messages.*', durable:2, expiry_policy:'never'}, autoaccept:false});
//connection.open_receiver('$sys.mqtt.retain.apps.tilechat.users.*.messages.*');
//({name:'amq.topic1', target:{address:'apps.tilechat.users.*.conversations.*', durable:2, expiry_policy:'never'}} ); 



