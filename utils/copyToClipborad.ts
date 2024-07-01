export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(
    () => {
      // Do nothing
    },
    function (err) {
      throw new Error(err);
    }
  );
};
