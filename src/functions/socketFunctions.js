const addUser = async (user, socket) => {
  const index = global.onlineUsers.findIndex((user2) => {
    return user2.user == user;
  });
  if (index == -1) {
    global.onlineUsers.push({ user, socket, date: Date.now() });
  } else {
    global.onlineUsers[index].socket = socket;
  }
  console.log("added user", global.onlineUsers);
};

const removeUser = async (socket) => {
  const removedUser = global.onlineUsers.find((user) => {
    return user.socket == socket;
  });
  global.onlineUsers = global.onlineUsers.filter((user) => {
    return user.socket !== socket;
  });
  console.log("removed user", removedUser);
};

const sendNotificationSocket = async (user, message, type, link, title) => {
  const index = global.onlineUsers.findIndex((user2) => {
    return user2.user == user;
  });
  if (index !== -1) {
    global.io.to(global.onlineUsers[index].socket).emit("notification", {
      message,
      type,
      link,
      title,
    });
  }
};

const paymentConfirmation = async (user, data) => {
  const index = global.onlineUsers.findIndex((user2) => {
    return user2.user == user;
  });
  if (index !== -1) {
    global.io
      .to(global.onlineUsers[index].socket)
      .emit("paymentConfirmation", data);
  }
};

module.exports = {
  addUser,
  removeUser,
  sendNotificationSocket,
  paymentConfirmation,
};
