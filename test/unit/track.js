describe("Keen tracking methods", function() {

  describe("#addEvent", function() {

    describe("via XHR/CORS (if supported)", function(){

      beforeEach(function() {
        var self = this;
        self.project = new Keen({
          projectId: keenHelper.projectId,
          writeKey: keenHelper.writeKey,
          host: keenHelper.host,
          requestType: 'xhr'
        });
        self.postUrl = self.project.client.endpoint + "/projects/" + self.project.client.projectId + "/events/" + keenHelper.collection;
        self.server = sinon.fakeServer.create();
        self.respondWith = function(code, body){
          self.server.respondWith("POST", self.postUrl,
            [code, { "Content-Type": "application/json"}, body]);
        };
      });

      afterEach(function(){
        this.server.restore();
      });

      if ('withCredentials' in new XMLHttpRequest()) {

        it("should post to the API using xhr where CORS is supported", function() {

          var callbacks = [sinon.spy(), sinon.spy()];
          this.respondWith(200, keenHelper.responses.success);
          this.project.addEvent(keenHelper.collection, keenHelper.properties, callbacks[0], callbacks[1]);
          this.server.respond();

          expect(this.server.requests[0].requestBody)
            .to.equal(JSON.stringify(keenHelper.properties));
          expect(callbacks[0].calledOnce).to.be.ok;
          expect(callbacks[0].calledWith(JSON.parse(keenHelper.responses.success))).to.be.ok;
          expect(callbacks[1].calledOnce).not.to.be.ok;

        });

        it("should post to the API using xhr and addEvents where CORS is supported", function() {

          var callbacks = [sinon.spy(), sinon.spy()];
          this.respondWith(200, keenHelper.responses.success);
          // keen.addEvents("collectionName", [{ a : 1 }, { a : 2 }])
          this.project.addEvents(keenHelper.collection, [keenHelper.properties, keenHelper.properties], callbacks[0], callbacks[1]);
          this.server.respond();

          expect(this.server.requests[0].requestBody)
            .to.equal(JSON.stringify(keenHelper.properties));
          expect(callbacks[0].calledOnce).to.be.ok;
          expect(callbacks[0].calledWith(JSON.parse(keenHelper.responses.success))).to.be.ok;
          expect(callbacks[1].calledOnce).not.to.be.ok;

        });

        it("should call the error callback on error", function() {

          var callbacks = [sinon.spy(), sinon.spy()];
          this.respondWith(500, keenHelper.responses.error);
          this.project.addEvent(keenHelper.collection, keenHelper.properties, callbacks[0], callbacks[1]);
          this.server.respond();

          expect(this.server.requests[0].requestBody)
            .to.equal(JSON.stringify(keenHelper.properties));
          expect(callbacks[0].calledOnce).not.to.be.ok;
          expect(callbacks[1].calledOnce).to.be.ok;

        });

      }

    });

    describe("via JSONP to a fake server", function(){

      beforeEach(function() {
        this.project = new Keen({
          projectId: keenHelper.projectId,
          writeKey: keenHelper.writeKey,
          host: keenHelper.host,
          requestType: 'jsonp'
        });
      });

      it("should add a script tag with a URL that has data and modified params", function(){

        this.project.addEvent(keenHelper.collection, keenHelper.properties);
        var tag = document.getElementById("keen-jsonp");
        expect(tag).to.exist;
        expect(tag.src).to.contain("data=");
        expect(tag.src).to.contain("modified=");

      });

    });

    describe("via Image Beacon to a fake server", function(){

      /*
      beforeEach(function() {
        this.project = new Keen({
          projectId: keenHelper.projectId,
          writeKey: keenHelper.writeKey,
          host: keenHelper.host,
          requestType: 'beacon'
        });
      });

      it("should add an image tag", function(){

        var callbacks = [function(){ console.log('here'); }, sinon.spy()];
        this.project.addEvent(keenHelper.collection, keenHelper.properties, callbacks[0], callbacks[1]);

        var tag = document.getElementById("keen-beacon");
        //expect(tag).to.exist;
        //expect(callbacks[0].calledOnce).to.be.ok;

      });
      */

    });

  });
});
