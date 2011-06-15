
module.exports=(function(){
    var _NA             = 0x00;
    var _TRIGGER        = 0x01;
    var _CONVERSATION   = 0x02;
    var _COMMAND        = 0x04;
    var _END            = 0x08;
    function parser(s) {
        this.mode=_TRIGGER;
        this.conv=null; // this is the current conversation being processed.
        this.triggers=[];
        this.buffer='';
        if (s) {this.monitor(s)}
    }
    var util=require('util');
    util.inherits(parser,require('events').EventEmitter);
    parser.prototype.monitor=function(stream) {
        this.stream=stream;
        var self=this;
        this.conv=null;
        this.buffer='';
        this.reset();
        this.stream.on('data',function(buf) {
            self.write(buf);
        });
    }
    parser.prototype.reset=function() {
        this.triggers.forEach(function(t) {t.used=false;t.last=0;t.conversation.forEach(function(c){c.used=false})});
    }
    function handleDecision(m,self) {
        m.forEach(function(i) {
            if (i[0].eat)
                i[0].used=true;
            check=true;
            var e=i[0];
            if (!e.push&&i[1].length)
                self.buffer=self.buffer.substr(i[1].index+i[1][0].length);
            if (e.send) {
                if (self.debug>1) console.log("Sending "+e.send);
                self.stream.write(e.send);
                //self.mode=_COMMAND;
            }
            if (e.emit) {
                if (self.debug>1) console.log("Emiting event "+e.emit[0]);
                self.emit(e.emit[0],e.emit[1],self);
            }
            if (e.handler) {
                if (self.debug>1) 
                    console.log("Executing handler "+e.handler.name);
                e.handler(i[1],i,self);
            }
            if (e.end) {
                if (self.debug>1) console.log("Ending conversation");
                self.mode=_END;
                check=false;
            }
            if (e.reset) {
                self.conv.conversation.forEach(function(i){i.used=false});
                self.conf.last=0;
            }
        });
    }
    parser.prototype.write=function(buf){
        var self=this;
        self.buffer+=buf.toString();
        if (self.debug>4) console.log('Data:"'+buf.toString()+'"');
        do {
            var check=false;
            if (self.mode&_TRIGGER) {
                if (self.debug>2) console.log('MODE TRIGGER: ');
                m=self.triggers.map(function(item,idx,ary) {
                    return item.sync?(item.used?[0,null]:[item,self.buffer.match(item.trigger)]):[item,self.buffer.match(item.trigger)];
                });
                m=m.filter(function(i){return i[1]!=null});
                if (m.length) {
                    self.mode=_CONVERSATION;
                    self.conv=m[0][0]; // only using the first matched trigger.
                    if (self.debug>3) console.log(self.conv);
                    self.conv.used=true;
                    if (self.debug>0) console.log('Starting conversation: '+m[0][1][0]);
                    self.buffer=self.buffer.substr(m[0][1].index+m[0][1][0].length);
                    check=true;
                }
            }
            if (self.mode&_CONVERSATION) {
                if (self.debug>2) console.log('MODE CONVERSATION: ');
                if (self.conv.sync) {
                    var m=self.conv.conversation;
                    var idx=self.conv.last||0;
                    var i=m[idx];// all synchronous items are consumed and not reused.
                    //while(m[idx]&&(i.eat&&i.used)) i=m[++idx];
                    var match=null;
                    if (i&&!i.used) {
                        if (i.branch) { // next item is a branch, test all next branches.
                            for (item=m[idx];item;idx++) {
                                if (!item.branch) break; // no branches matched.
                                if (self.debug>2) console.log('BRANCH: '+item.expect);
                                match=item.expect==null?[item,'']:[item,self.buffer.match(item.expect)];
                                if (match[1]) break; // only first branch match counts.
                            }
                            if (match) { // we have a match!
                                while(self.conv.conversation[self.conv.last].branch)self.conv.conversation[(++self.conv.last)].used=true; // mark all consecutive branch commands used.
                                if (self.debug>2) console.log('BRANCH: match '+match[1][0]);
                                check=true;
                                handleDecision([match],self);
                            }
                        } else {
                            if (self.debug>2) console.log('SYNC MATCH: '+i.expect);
                            if (i.expect==null) m=['']; // this is an open execute.
                            else
                            if (!(m=self.buffer.match(i.expect))) continue; // no match on the next item.
                            else
                            if (self.debug>3) console.log('SYNC MATCHED:'+m[0]);
                            self.conv.last++;
                            check=true;
                            i.used=true;
                            handleDecision([[i,m]],self);
                        }
                    } else 
                        console.log("Error. We only have used expects. This shouldn't happen. ("+idx+") "+i);
                } else { // Async matching. All matches have their handlers executed.
                    if (self.debug>2) console.log('ASYNC MATCH');
                    m=self.conv.conversation.map(function(item,idx,ary) {
                        return item.eat?// if we are suppose to not re-use this expect after it is matched, then check if it's used.
                                (item.used?[item,null]:item.expect==null?[item,'']:[item,self.buffer.match(item.expect)])
                               :item.expect==null?[item,'']:[item,self.buffer.match(item.expect)];
                    });
                    m=m.filter(function(i){return i[1]!=null}); // Filter out non-matches
                    if (self.debug>3)
                        console.log('ASYNC MATCH: '+m);
                    handleDecision(m,self);
                }
            }
            /*
            if (self.mode&_COMMAND) {
                console.log("COMMAND:"+self.command);
                console.log('"'+self.buffer+'"');
                console.log(self.buffer.match(self.command));
                if (m=self.buffer.match(self.command)) { // eat the echo'd command.
                    self.buffer=self.buffer.substr(self.buffer.indexOf(m[0])+m[0].length);
                    self.mode=_CONVERSATION;
                }
            }
            */
            if (self.mode&_END) {
                if (self.debug>3) console.log("END");
                self.mode=_TRIGGER; // restart
                check=false;
            }
        } while (check);
    }
    parser.prototype.conversation=function(trigger) { // if eat==true then when it's matched, remove it.
        var self=this;
        var c={
            parser: self,
            data: {trigger: trigger,conversation:[],sync: false,used:false,last: 0},
            sync: function() { this.data.sync = true; return this }, // if true then match the expect rules synchronously.
            branch: function(e) {
                d=this.expect(e);
                d.p.d.branch=true;
                return d;
            },
            expect: function(e,eat) {
                var slf=this; // this should be c
                if (this.data.sync) eat=true;
                var d={expect:(typeof e=='string')?new RegExp(e):e,used:false,eat: eat};
                this.data.conversation.push(d);
                return { // this should be anonymous.
                    d:d,
                    p:slf,
                    send: function(s) { // send text out when expect
                        this.d.send=s;
                        return this;
                    },
                    emit: function(e,p) { // emit an event when expect
                        this.d.emit=[e,p];
                        return this;
                    },
                    handler: function(c) { // callback when expect
                        this.d.handler=c;
                        return this;
                    },
                    end: function(){this.d.end=true;return this}, // End this conversation when expect matches
                    reset: function(){this.d.reset=true;return this},
                    push: function(){this.d.push=true;return this},
                    branch: function(e){return this.p.branch(e)},
                    expect: function(e) {return this.p.expect(e)}, // start a new expect with new actions.
                    conversation: function(t) {return this.p.parser.conversation(t)}, // start up a new conversation with a new trigger.
                    monitor:function(m) {this.p.parser.monitor(m);return self}
                }
            },
            monitor:function(m) {this.parser.monitor(m);return self},
            conversation: function(t) {return self.conversation(t)}
        }
        this.triggers.push(c.data);
        return c;
    }

    return parser;

})()
