
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
create view FreelancerDashboard as
    SELECT f.freelancer_id ,
        f.hourly_rate ,
        f.total_earned,
        avg(r.rating) as avg_rating
        from Reviews as r join Freelancers as f on f.freelancer_id=r.reviewee_id group by f.freelancer_id;
 
--ammount is given by user to make sure the output only includes only those freelancers that have rating more than or equal to give number and hourly rate less than or equal to given number
SELECT  b.bid_id , 
    b.job_id, 
    b.freelancer_id, 
    b.bid_amount ,b.status,f.avg_rating FROM Bids AS b JOIN FreelancerDashboard AS f ON b.freelancer_id=f.freelancer_id WHERE f.avg_rating >= RATING AND b.job_id = JOB_ID AND b.status = 'Pending' ORDER BY f.avg_rating DESC;

CREATE VIEW ClientDashboard AS
    SELECT c.client_id ,
        c.company_name ,
        c.total_spent,
        avg(r.rating) as avg_rating
        from Reviews as r join Client as c on c.client_id=r.reviewee_id group by c.client_id;
--get jobs based on client rating
select j.job_id ,j.client_id ,j.title ,j.description ,j.budget ,j.status ,c.avg_rating from 
Jobs as j join ClientDashboard as c on j.client_id=c.client_id where c.avg_rating >= RATING ORDER BY c.avg_rating DESC; 
  
  -- Sort bids by:
-- Lowest price
SELECT * FROM Bids ORDER BY bid_amount ASC;
-- Highest rating
SELECT  b.bid_id , 
    b.job_id, 
    b.freelancer_id, 
    b.bid_amount ,b.status,f.avg_rating FROM Bids AS b JOIN FreelancerDashboard AS f ON b.freelancer_id=f.freelancer_id ORDER BY f.avg_rating DESC;
-- Top 3 bids (greedy selection based on best combination of low pay + high rating)
SELECT  b.bid_id , 
    b.job_id, 
    b.freelancer_id, 
    b.bid_amount ,b.status,f.avg_rating FROM Bids AS b JOIN FreelancerDashboard AS f ON b.freelancer_id=f.freelancer_id ORDER BY (bid_amount/f.avg_rating) ASC LIMIT 3;


-- Admin System Overview\

CREATE OR REPLACE VIEW admin_system_overview AS
WITH revenue_cte AS (
    SELECT 
        con.contract_id,
        SUM(p.amount) AS total_paid
    FROM Contracts con
    JOIN Milestones m ON con.contract_id = m.contract_id
    JOIN Payments p ON m.milestone_id = p.milestone_id
    WHERE p.payment_status = 'Paid'
    GROUP BY con.contract_id
),
job_stats AS (
    SELECT 
        status,
        COUNT(*) AS total_jobs
    FROM Jobs
    GROUP BY status
),
user_stats AS (
    SELECT 
        role,
        COUNT(*) AS total_users
    FROM Users
    GROUP BY role
)
SELECT (SELECT SUM(total_paid) FROM revenue_cte) AS total_platform_revenue,
    (SELECT COUNT(*) FROM Contracts WHERE status = 'Active') AS active_contracts,
    (SELECT total_users FROM user_stats WHERE role = 'client') AS total_clients,
    (SELECT total_users FROM user_stats WHERE role = 'freelancer') AS total_freelancers,
    (SELECT total_jobs FROM job_stats WHERE status = 'Open') AS open_jobs,
    (SELECT total_jobs FROM job_stats WHERE status = 'In Progress') AS ongoing_jobs,
    (SELECT total_jobs FROM job_stats WHERE status = 'Complete') AS completed_jobs;

    -- select query by Admin

    select * from Admin_System_Overview