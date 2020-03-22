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