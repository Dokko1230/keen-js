Keen.Dataset.prototype.modifyRow = function(index, mod){
  if (mod instanceof Array) {
    this.data.output[index] = mod;
  } else if (typeof mod === "function") {
    this.data.output[index] = mod.call(this, this.data.output[index]);
  }
  return this;
};

Keen.Dataset.prototype.modifyColumn = function(index, mod){
  var self = this;
  if (mod instanceof Array) {
    each(self.data.output, function(row, i){
      var val = (typeof mod[i] !== "undefined" ? mod[i] : null);
      self.data.output[i][index] = val;
    });
  } else if (typeof mod === "function") {
    each(self.data.output, function(row, i){
      self.data.output[i][index] = mod.call(self, self.data.output[i][index], i, self.data.output[i]);
    });
  }
  return self;
};
