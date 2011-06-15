# Expect For Node
      
  A stream based Expect utility for interacting with streams.
  
     var Expect = require('node-expect');
     var socket = new require('net').Socket({type:'tcp4'});
     var parser = new Expect();
     var p = new promise();
     parser.conversation(/connect/i) // Start a conversation matching the connection text from the telnet server in the stream as the trigger.
                .sync()           // The expect rules are synchronous, and run in order.
                .expect(/login/i)     // First expect rule matches the login prompt.
                  .send("myuser\n")     // Send user login ID.
                .expect(/password/)   // We are expecting a password prompt next.
                  .send("mypassword\n") // Now send the password.
                .branch(/denied/i)    // Branch is a special expect rule, where it will test all consecutive branch definitions to decide which match to follow.
                                      // This is handy when you want to run rules synchronously but have a section of async rules run as one synchronous rule.
                  .reset()            // Reset will reset the current conversation thread so that it is as if the first expect in this conversation never started.
                                      // This allows you to restart conversation matching on a synchronous rule set without needing to match the conversation trigger.
                .branch(/\$ /)        // Another branch to match.
                  .push()             // Push match back into the stream. The end result is that the next conversation will pick up the match since we are ending this one.
                  .emit('connected')  // Emit an event named "connected". Other parts of the program can k
                  .handler(p.fulfil)  // Call the fulfil function of the promise.
                  .end()              // End this conversation.
           .conversation(/\$ /)       // Start this conversation on a shell prompt. This conversation won't be synchronous.
                .expect(null,true)    // Don't expect anything. The conversation trigger is enough. Just do the action. Then consume this rule, not to run again.
                  .send("echo 'I win!'\n")
                .expect(/\$ /)        // Expecting the prompt again.
                  .send("exit")
                .expect(/closed/i)
                  .handler(           // Call an anonymous handler
                   function(){
                     socket.destroy();// Be sure to destroy the socket so node isn't left hanging.
                  });
                  .end()              // End this conversation.
           .monitor(socket);          // Monitor the socket for input. Also, uses the socket as its output.

     socket.connect(23,'127.0.0.1');

     p.when(function() {
        console.log('We logged in!');
     });

## Installation

  Clone this repository into your node_modules directory.

  - or -

     $ npm install node-expect


## Features

  * Follows the builder pattern for simple script construction.
  * Acts like a WriteableStream
  * Simple attaching input to a stream with pipes, or using built-in monitor.
  * Large set of commands to react to matched patterns in stream.

## TODO
  * Write tests.

## API

### Construction

     Expect = require('node-expect');
     parser = new Expect();

  Constructing a new Expect() object returns a parser object that is used to start building a set of conversations.

  * conversation = parser.conversation(TRIGGER PATTERN)
      Starts a new conversation. A conversation allows narrowing to a set of expect rules with their own conversational path.
  * conversation.synch()
      Turns on synchronous matching of expect rules. Otherwise all rules are considered each time something new arrives in the stream.
  * expect = conversation.expect(PATTERN,mark)
      Sets an expect rule to match content in the stream. If mark==true then when this rule matches, do not allow subsequent matches. This is default in synchronous conversations.
  * expect = conversation.branch(PATTERN,mark)
      Exactly like creating an expect rule, except this will roll up all consecutive branch calls as one expect rule. Only the first will have its commands evaluated.
  * expect.send(String)
      Sends a string out the monitored stream. This is handy for socket streams that are two ways. An error will occur if the monitored stream is read only, closed, or unavailable.
  * expect.emit(name)
      This will emit the named event with the results of the expect pattern match as the parameter.
  * expect.handler(callbackFunction)
      This will call the callback function with the results of the expect pattern match as the first parameter, and the parser object as the second.
  * expect.reset()
      Causes the current conversation to be reset and act as if no expect rules have yet been matched.
  * expect.end()
      End the current conversation. The parser will match on conversation patterns after this action is executed.
  * expect.push()
      Push the results of the last match back to the buffer. This allows another rule, or conversation to match this text again.


### Interaction

  The following methods are available for channels:

  * parser.monitor(stream)
      Sets the stream to be monitored. All conversations are reset when this is called.
  * parser.reset()
      Resets all conversations.
  * parser.write(string)
      Write to the parser like a stream.

## License

(The MIT License)

Copyright (c) 2011 Brandon Myers <trakkasure@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

