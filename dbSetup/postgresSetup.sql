CREATE TABLE users (
    id uuid DEFAULT uuid_generate_v4 (),
    fullname VARCHAR(60) NOT NULL,
    email VARCHAR(80) NOT NULL,
    pass CHAR(60) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE(email)
);

CREATE TABLE ads (
    ad_id uuid DEFAULT uuid_generate_v4 (),
    issuedAt DATE DEFAULT current_date,
    price MONEY NOT NULL,
    title VARCHAR(100) NOT NULL,
    details VARCHAR(300) NOT NULL,
    country VARCHAR(30) NOT NULL,
    user_id uuid REFERENCES users(id),
    PRIMARY KEY (ad_id),
    CHECK (price>=0::money) 
);

CREATE TABLE active (
    user_id uuid REFERENCES users(id) PRIMARY KEY,
    socket_id CHAR(20) NOT NULL UNIQUE
);

CREATE TABLE chats (
    sender_id uuid REFERENCES users(id),
    receiver_id uuid REFERENCES users(id),
    id uuid DEFAULT uuid_generate_v4 (),
    PRIMARY KEY (id)
);

CREATE TABLE messages (
    id BIGSERIAL,
    chat_id uuid REFERENCES chats(id),
    msg VARCHAR(255) NOT NULL
);