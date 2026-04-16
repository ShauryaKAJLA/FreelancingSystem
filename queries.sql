
-- Jobs Management
-- Get all jobs
SELECT * FROM JOBS WHERE STATUS="Open";
-- Get all jobs posted by a particular client
-- ID = GIVEN BY USER
SELECT * FROM JOBS WHERE client_id = ID;
-- Get job by ID (detailed view)
SELECT * FROM JOBS WHRE job_id = ID;
-- Update job details
-- DATA WILL BE GIVEN FROM USERS 
UPDATE JOBS SET title = NEW_TITLE, description = NEW_DESC, budget = NEW_BUDGET WHERE job_id = ID;
-- Delete job
DELETE FROM JOBS WHERE job_id = ID;
-- Close job (stop accepting bids)
UPDATE FROM JOBS SET STATUS="In Progress" WHERE job_id = ID ;

-- Bids Management

-- Get all bids for a job
SELECT * FROM Bids WHERE job_id = ID;
-- Get all bids placed by a freelancer      
SELECT * FROM Bids WHERE freelancer_id=ID;
-- Filter bids by:
-- Pay (min/max budget)
SELECT * FROM Bids ORDER BY bid_amount DESC;
SELECT * FROM Bids ORDER BY bid_amount ASC;
-- Freelancer rating

SELECT freelancer_id ,
    user_id ,

    hourly_rate DECIMAL(10, 2) NOT NULL,
    total_earned

SELECT * FROM 
SELECT * FROM Bids WHERE 
-- Sort bids by:
-- Lowest price
-- Highest rating
-- Top 3 bids (greedy selection)
-- → Based on best combination of low pay + high rating


