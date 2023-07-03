Chat21Client.js CHANGELOG

### v0.1.12.6
- connect() callback() invoked immediatly afte connect(). No more after client.subscribe - start() method - that is experiences weird delay.

### v0.1.12.5
- added a snippet to automatically get the host location when deployed on localhost
    var loc = window.location, new_uri;
    if(window.frameElement && window.frameElement.getAttribute('tiledesk_context') === 'parent'){
        loc = window.parent.location
    }

### v0.1.12.4
- added presence topic con connect() publish
- added ImHere() to chat21Client.js


### v0.1.12.3
- RESTORED if (savedMessage.attributes && savedMessage.attributes.updateconversation == false) {update_conversation = false}. See v0.1.12.2

### v0.1.12.2
- - removed if (savedMessage.attributes && savedMessage.attributes.updateconversation == false) {update_conversation = false}. Now conversations are always updated. Same modification also on observer.js

### v0.1.12.1
- some console.log() hidden

### v0.1.12
- "connect()" event now replies with a callback only after full subscribing has succeded!
- options._log => options.log

### v0.1.11
- crossConversationDetail improved with xmlhttprequest + nodejs request support

### v0.1.10
- added archivedConversationDetail()
- added crossConversationDetail()
- refactored conversationDetail() impl to use crossConversationDetail()
    
### v0.1.9
- added /outgoing to write path
- modified options.log => options._log

### v0.1.8
- added saveInstance() for push notifications

### v0.1.7
- removed logs

### v0.1.6
- added removeOnMessageAddedHandler()
- added removeOnGroupUpdatedHandler()

### v0.1.5
- added groupSetMembers()
- renamed createGroup() in groupCreate()
- renamed leaveGroup() in groupLeave()
- renamed joinGroup() in groupJoin()
- renamed getGroup() in groupData()

### v0.1.4
- added basicMessageBuilder()
- added sendMessageRaw()
- added leaveGroup()