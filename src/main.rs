use reqwest;
use std::error::Error;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use regex::Regex;
use std::time::Duration;
use std::threat::sleep;

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
        match orphan_detection() {
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
        
        /* Find blockroot information */
        match verify_blockroot() {
                Ok(_) => println!("Extraction completed."),
                Err(e) =>  {
                        eprintln!("Err occurred in find_validator: {}", e);
                        let err_msg = format!("Program is closing due to error in find_validator as per the following: {}", e);
                        match send_to_slack(&err_msg).await {
                            Ok(_) => println!("Err message relayed to Slack. "),
                            Err(e) => eprintln!("Err message could not be sent to Slack: {}", e),
                        }
                        return;
                }
        }
}



/* Name: send_to_slack
 * Input: The address of a string message to send via Slack
 * Panics: None
 * Errors: Will throw error if webhook link or msg are invalid
 */
async fn send_to_slack(msg: &str) -> Result<(), Box<dyn Error>> {
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


/* Name: orphan_detection
 * Input: None
 * Panics: None
 * Errors: Will throw error if any of the log information is formatted 
 *         different than expected.
 * 
 * 
 */

 // This function has many bugs and is not complete.
fn orphan_detection() -> Result<(), Box<dyn Error>> {
        let mut child = Command::new("journalctl")
                .arg("-f")
                .stdout(Stdio::piped())
                .spawn()?;

        let reader = BufReader::new(child.stdout.take().unwrap());

        let re_proposal = Regex::new(r"timeTillDuty=([\d\w]+).*slot=(\d+)")?;
        let re_submission = Regex::new(r#"time="(\d+-\d+-\d+ \d+:\d+:\d+)" level=info msg="Submitted new block""#)?;

        for line_result in reader.lines() {
                let line = line_result?;
                if let Some(captures) = re_proposal.captures(&line) {
                        let time_till_duty = &captures[1];
                        println!("Found timeTillDuty: {}", time_till_duty);
                } else if let Some(captures) = re_submission.captures(&line) {
                        let submission_time = &captures[1];
                        let slot_id = &captures[2].parse()?;
                        verify_blockroot(block_root)?;
                        println!("Found submission time: {}", submission_time);
                        println!("Found block_root: {}", block_root);
                }
        }

        Ok(())
}



/* Name: verify_blockroot
 * Input: None
 * Panics: None.
 * Errors: Will throw error if the journalctl logs do not contain 
 *         the pubKey variable.
 */
 fn verify_blockroot() -> Result<(), Box<dyn Error>> {
        let url = "https://beaconcha.in/api/v1/slot/6919473";
        let response = request::get(url).await?.json().await?;
        Ok(response)
}
