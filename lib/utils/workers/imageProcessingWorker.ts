// type WorkerInput = {
//   buffer: ArrayBuffer;
//   width: number;
//   height: number;
// };

// type WorkerOutput = {
//   buffer: ArrayBuffer;
// };

// self.onmessage = (e: MessageEvent<WorkerInput>) => {
//   const { buffer, width, height } = e.data;
//   // Implement your image processing logic here

//   // Example: Just echo back the received buffer
//   // Make sure to pass the buffer within an object and specify the buffer in a transfer list
//   self.postMessage({ buffer }, [buffer]); // Correctly transferring the buffer back
// };

export {};
