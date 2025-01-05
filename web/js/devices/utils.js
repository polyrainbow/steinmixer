export const arraysAreEqual = (array1, array2) => {
  return array1.length === array2.length
    && array1.every(
      function (value, index) { return value === array2[index]; },
    );
};
