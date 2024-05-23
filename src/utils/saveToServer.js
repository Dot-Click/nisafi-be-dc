const path = require("path");
const fs = require("fs");
const saveToServer = async (files) => {
  try {
    //if upload folder does not exist, create it
    if (!fs.existsSync(path.join(__dirname, "../../uploads"))) {
      fs.mkdirSync(path.join(__dirname, "../../uploads"));
    }

    if (files === null || files === undefined) {
      throw new Error("No file uploaded");
    }

    return Promise.all(
      files.map(async (file) => {
        const filePath = `/uploads/${Date.now()}-${file.name}`;

        await file.mv(path.join(__dirname, `../..${filePath}`), (err) => {
          if (err) {
            throw new Error("Error saving file");
          }
        });

        return filePath;
      })
    ).then((filePaths) => {
      return filePaths;
    });
  } catch (error) {
    return error;
  }
};

module.exports = saveToServer;
