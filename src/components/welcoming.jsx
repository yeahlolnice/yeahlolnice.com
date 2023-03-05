import {Container, Row, Col} from "react-bootstrap";

function welcome() {
    return (
        <>
            <Container style={{height: "100vh"}}>
                <Row>
                    <Col>
                        <div className="welcome">
                            <h1 className="title">Yeahlolnice</h1>
                        </div> 
                    </Col>
                </Row>
            </Container>
        </>
    )
}
export default welcome;