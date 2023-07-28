use reqwest;
use std::error::Error;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use regex::Regex;
use regex::Captures;
use chrono::{DateTime, Utc, TimeZone};
use std::time;
// use std::fs::File; // This is for testing

const TIME_CONSTRAINT: u64 = 5;

/*******************************  main  *******************************
 *
 * A program to detect orphaned blocks and send alerts via Slack and the local
 * terminal.
 *
**********************************************************************/
#[tokio::main]
async fn main()
{
        /* Send initial message to Slack */
        match send_to_slack("Orphan program starting.").await {
                Ok(_) => println!("Connection established with Slack environment."),
                Err(e) => {
                        eprintln!("An error occurred in send_to_slack: {}", e);
                        return;
                }
        }

        
        /* The loop to detect orphaned blocks */
        match time_checker().await {
                Ok(_) => println!("Extraction completed."),
                Err(e) => {
                        eprintln!("An error occurred: {}", e);
                        let err_msg = format!("Program is closing due to error in orphan_detection as per the following: {}", e);
                        match send_to_slack(&err_msg).await {
                                Ok(_) => println!("Err message successfully sent to Slack."),
                                Err(e) => eprintln!("Err message could not be sent to Slack: {}", e),
                        }
                        return;
                }
        }

        /* Send closing message to Slack */
        match send_to_slack("Orphan program is closing.").await {
                Ok(_) => println!("Connection ending with Slack environment."),
                Err(e) => {
                        eprintln!("An error occurred in send_to_slack: {}", e);
                        return;
                }
        }
}



/* Name: send_to_slack
 * Input: The address of a string message to send via Slack
 * Panics: None
 * Errors: Will throw error if webhook link or msg are invalid
 */
async fn send_to_slack(msg: &str) -> Result<(), Box<dyn Error>> 
{
        let webhook_url = "https://hooks.slack.com/services/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";
        let client = reqwest::Client::new();
        let res = client.post(webhook_url)
                .json(&serde_json::json!({
                        "text": msg
                }))
                .send()
                .await?;

        println!("Response: {:?}", res.status());
        Ok(())
}

/* Name: time_checker
 * Input: None
 * Panics: Checks on Regex lines and line parsing within BufReader object.
 * Errors: Will throw error if any of the log information is formatted 
 *         different than expected.
 */
 async fn time_checker() -> Result<(), Box<dyn Error>> 
 {
        let mut child = Command::new("journalctl")
                .arg("-f")
                .stdout(Stdio::piped())
                .spawn()?;
        let reader = BufReader::new(child.stdout.take().unwrap());

        // Uncomment the file below for testing.
        // let file = File::open("src/validator_logs.txt")?;
        // let reader = BufReader::new(file); 

        // Initialize desired expression formats and data vectors.
        let re_proposal = Regex::new(r#"time="(\d+-\d+-\d+ \d+:\d+:\d+)".*level=info.*msg="Proposal schedule".*pubKey=(0x[\da-fA-F]+).*slot=(\d+).*timeTillDuty=([\d\w]+)"#)?;
        let re_submission = Regex::new(r#"time="(\d+-\d+-\d+ \d+:\d+:\d+)".*level=info.*msg="Submitted new block""#)?;
        let mut time_limits: Vec<(String, DateTime<Utc>, String)> = Vec::new();
        let mut submissions: Vec<DateTime<Utc>> = Vec::new();

        
        let mut case_entered = false;
        for line in reader.lines() {
                let line = line?;
                if re_proposal.is_match(&line) { // If a proposal is detected
                        let captures = Some(re_proposal.captures(&line).unwrap());
                        add_proposal(captures, &mut time_limits);
                        case_entered = true;
                } else if re_submission.is_match(&line) { // If a submission is detected
                        let captures = Some(re_submission.captures(&line).unwrap());
                        add_submission(captures, &mut submissions);
                        case_entered = true;
                }
                if case_entered {
                        check_times(&mut time_limits, &mut submissions).await;
                        case_entered = false;
                }
        }
        Ok(())
}


/* Name: check_times
 * Input: The vectors that contain time limit and submission information.
 * Panics: None.
 * Errors: There will be unexpected behavior if the submissions vector happens 
 *         to be longer than the time_limits, or if the elements within the 
 *         vectors are misaligned.
 */
 async fn check_times(time_limits: &mut Vec<(String, DateTime<Utc>, String)>, submissions: &mut Vec<DateTime<Utc>>) 
 {
        let mut to_remove = Vec::new();
        for (i, (time_limit, submission)) in time_limits.iter().zip(submissions.iter()).enumerate() {
                if time_limit.1 > *submission {
                        to_remove.push(i);
                } else if time_limit.1 <= *submission {
                        let error_msg = format!("There has been a potentially orphaned block at slot {} by validator {}.\nThe time limit was {}, but has been submitted at {}", time_limit.0.clone(), time_limit.2.clone(), time_limit.1, submission);
                        match send_to_slack(&error_msg).await {
                                Ok(_) => println!("Sending an error to Slack regarding validator orphan risk with {}.", time_limit.2.clone()),
                                Err(e) => {
                                        eprintln!("An error occurred in send_to_slack: {}", e);
                                        return;
                                }
                        }
                        to_remove.push(i);
                }
        }
        to_remove.reverse();
        for i in to_remove {
            time_limits.remove(i);
            submissions.remove(i);
        }
    }
    


/* Name: add_proposal
 * Input: A Captures object of the date and time_limits vector by reference.
 * Panics: None.
 * Errors: None.
 */
fn add_proposal(captures: Option<Captures>, time_limits: &mut Vec<(String, DateTime<Utc>, String)>) 
{
        match captures {
            Some(captures) => {
                // Calculate the time limit and push onto the vector 
                // with the corresponding slot #
                let time_limit = get_time_limit(&captures[1], &captures[4]);
                time_limits.push((captures[3].to_string(), time_limit, captures[2].to_string()));
            },
            None => {
                println!("No captures found for this proposal.");
            }
        }
}



/* Name: add_submission
 * Input: A Captures object of the date and submissions vector by reference.
 * Panics: None.
 * Errors: None.
 */
fn add_submission(captures: Option<Captures>, submissions: &mut Vec<DateTime<Utc>>) 
{
        match captures {
                Some(captures) => {
                        // Redefine the string as a date object and push 
                        // onto vector.
                        let date = Utc.datetime_from_str(&captures[1], "%Y-%m-%d %H:%M:%S").unwrap();
                        submissions.push(date);
                },
                None => {
                        println!("No captures found for this proposal.");
                }
        } 
}



/* Name: get_time_limit
 * Input: A string of the time, and the allocated time for completion.
 * Panics: None.
 * Errors: There will be unexpected behavior if the string time is incorrectly
 *         formatted.
 */
fn get_time_limit(time: &str, time_till_duty: &str) -> DateTime<Utc> {
        let time = Utc.datetime_from_str(time, "%Y-%m-%d %H:%M:%S").unwrap();
        
        let duration = if time_till_duty.len() > 3 {
            let re_duration = Regex::new(r"(\d+)m(\d+)s").unwrap();
            let captures = re_duration.captures(time_till_duty).unwrap();
            let minutes = captures.get(1).unwrap().as_str().parse::<u64>().unwrap();
            let seconds = captures.get(2).unwrap().as_str().parse::<u64>().unwrap();
            time::Duration::from_secs(minutes * 60 + seconds + TIME_CONSTRAINT)
        } else {
            let re_duration = Regex::new(r"(\d+)s").unwrap();
            let captures = re_duration.captures(time_till_duty).unwrap();
            let seconds = captures.get(1).unwrap().as_str().parse::<u64>().unwrap();
            time::Duration::from_secs(seconds + TIME_CONSTRAINT)
        };
        
        time + chrono::Duration::from_std(duration).unwrap()
}