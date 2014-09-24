Keen.Dataset.prototype.sum = function(arr, start, end){
  // Copy set with given range
  var set = arr.slice(start||0, (end ? end+1 : arr.length)),
      sum = 0;
  // Add numeric values
  each(set, function(val, i){
    if (typeof val === "number" && !isNaN(parseFloat(val))) {
      sum += parseFloat(val);
    }
  });
  return sum;
};
