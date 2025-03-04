-- Clients table
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE
);

-- Accounts table
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    account_number VARCHAR(10) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    subledger_type VARCHAR(50),
    provider VARCHAR(100),
    is_manual BOOLEAN DEFAULT TRUE
);

-- Transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    date DATE NOT NULL,
    transaction_no VARCHAR(50),
    line_no INTEGER,
    document_number VARCHAR(50),
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('debit', 'credit')),
    category VARCHAR(50),
    subledger_type VARCHAR(50),
    journal_type VARCHAR(50),
    vendor_name VARCHAR(255),
    employee_id INTEGER,
    project_id INTEGER,
    is_manual BOOLEAN DEFAULT TRUE
);

-- JournalEntries table
CREATE TABLE journal_entries (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    date DATE NOT NULL,
    transaction_no VARCHAR(50),
    description TEXT,
    debit_account INTEGER REFERENCES accounts(id),
    credit_account INTEGER REFERENCES accounts(id),
    amount DECIMAL(15,2) NOT NULL,
    created_by INTEGER REFERENCES clients(id),
    subledger_type VARCHAR(50),
    journal_type VARCHAR(50),
    is_manual BOOLEAN DEFAULT TRUE
);

-- PayrollEntries table
CREATE TABLE payroll_entries (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    employee_id INTEGER,
    date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('salary', 'bonus', 'deduction')),
    status VARCHAR(50),
    subledger_type VARCHAR(50),
    is_manual BOOLEAN DEFAULT TRUE
);

-- Files table
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    filename VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('Excel', 'PDF')),
    path VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_manual BOOLEAN DEFAULT TRUE
);

-- Reports table
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    type VARCHAR(50) NOT NULL,
    data JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fsli_bucket VARCHAR(50),
    is_manual BOOLEAN DEFAULT TRUE
);

-- Budgets table
CREATE TABLE budgets (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    account_number VARCHAR(10) NOT NULL,
    subledger_type VARCHAR(50),
    amount DECIMAL(15,2) NOT NULL,
    period VARCHAR(50) NOT NULL CHECK (period IN ('monthly', 'quarterly')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_manual BOOLEAN DEFAULT TRUE
);

-- CashFlowForecasts table
CREATE TABLE cash_flow_forecasts (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    forecast_period DATE NOT NULL,
    inflows DECIMAL(15,2) NOT NULL,
    outflows DECIMAL(15,2) NOT NULL,
    net_cash DECIMAL(15,2) NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ai_recommendations JSONB,
    is_manual BOOLEAN DEFAULT TRUE
);

-- AuditLogs table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    user_id INTEGER REFERENCES clients(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);
