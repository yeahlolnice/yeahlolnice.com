import {Container, Row, Col} from "react-bootstrap";

function nav() {
    return (
        <>
            <Container style={{height: "120px"}}>
                <Row>
                    <Col></Col>
                    <Col className="text-center">
                     <a href="/" style={{textDecorationLine: "none"}}><h1 className="home-button">Yeahlolnice</h1></a>
                    </Col>
                    <Col></Col>
                </Row>
            </Container>
        </>
    )
}
export default nav;